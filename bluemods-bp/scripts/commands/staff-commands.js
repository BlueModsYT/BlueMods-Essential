import { world, system, EquipmentSlot, Player, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { Command } from "../handler/CommandHandler.js";
import { addLog } from "../main/moderation/playerLogs.js";
import main from "../config.js";

//░███░░██░░██░░█░████░██░░██░░████░░████░░░███░
//░█░░█░█░░░░█░░█░█░░░░██░░██░█░░░█░░█░░░█░█░░█░
//░███░░█░░░░█░░█░███░░██░░██░█░░░░█░█░░░█░██░░░
//░█░░█░█░░░░█░░█░█░░░░█░██░█░█░░░░█░█░░░█░░░█░░
//░█░░█░█░░█░█░░█░█░░█░█░██░█░█░░░█░░█░░░█░█░░█░
//░███░░████░███░░████░█░█░░█░░███░░░████░░███░░
// https://dsc.gg/bluemods

//
// Ban Command
//

export function parseCustomDuration(durationStr) {
    if (!durationStr) return null;
    const match = durationStr.match(/^(\d+)([smhdw])$/);
    if (!match) return null;
    
    const multipliers = {
        's': 1000,
        'm': 60000,
        'h': 3600000,
        'd': 86400000,
        'w': 604800000
    };
    
    return parseInt(match[1]) * (multipliers[match[2]] || 0);
}

function getBanDatabase() {
    try {
        const data = world.getDynamicProperty("ban_database");
        return data ? JSON.parse(data) : { bannedPlayers: [] };
    } catch {
        return { bannedPlayers: [] };
    }
}

function saveBanDatabase(database) {
    world.setDynamicProperty("ban_database", JSON.stringify(database));
}

function getBannedPlayers() {
    return getBanDatabase().bannedPlayers || [];
}

function isPlayerBanned(playerName) {
    return getBanDatabase().bannedPlayers.find(
        p => p.name.toLowerCase() === playerName.toLowerCase() && !p.expired
    );
}

export function banPlayer(targetName, reason, moderator, duration = null) {
    const database = getBanDatabase();
    
    if (isPlayerBanned(targetName)) {
        moderator.sendMessage(`§7[§b#§7] §c${targetName} is already banned!`);
        return false;
    }
    
    let expiration = null;
    if (duration) {
        const durationMs = parseCustomDuration(duration);
        if (durationMs) expiration = Date.now() + durationMs;
    }
    
    database.bannedPlayers.push({
        name: targetName.toLowerCase(),
        displayName: targetName,
        reason: reason || "No reason specified",
        moderator: moderator.name,
        bannedAt: Date.now(),
        expiration: expiration,
        expired: false
    });
    
    saveBanDatabase(database);
    
    const targetPlayer = world.getPlayers().find(p => p.name.toLowerCase() === targetName.toLowerCase());
    if (targetPlayer) {
        const durationText = duration ? ` for ${duration}` : " permanently";
        const expirationText = expiration ? `\n§7Expires: §e${new Date(expiration).toLocaleString()}` : "\n§7Expires: §cNever";
        
        system.run(() => {
            targetPlayer.runCommand(`kick "${targetName}" §cYou have been banned${durationText}!\n§7Reason: §e${reason}\n§7Moderator: §e${moderator.name}${expirationText}`);
        });
    }
    
    return true;
}

function unbanPlayer(targetName, moderator) {
    const database = getBanDatabase();
    const banIndex = database.bannedPlayers.findIndex(
        p => p.name.toLowerCase() === targetName.toLowerCase() && !p.expired
    );
    
    if (banIndex === -1) {
        moderator.sendMessage(`§7[§b#§7] §c${targetName} is not banned!`);
        return false;
    }
    
    const unbannedPlayer = database.bannedPlayers[banIndex];
    database.bannedPlayers.splice(banIndex, 1);
    saveBanDatabase(database);
    
    moderator.sendMessage(`§7[§b#§7] §aSuccessfully unbanned §e${unbannedPlayer.displayName}§a!`);
    
    world.getPlayers({ tags: ["notify"] }).forEach(admin => {
        admin.sendMessage(`§7[§e#§7] §e${moderator.name} §ahas unbanned §e${unbannedPlayer.displayName}`);
    });
    
    return true;
}

system.runInterval(() => {
    const database = getBanDatabase();
    let updated = false;
    
    database.bannedPlayers.forEach(ban => {
        if (!ban.expired && ban.expiration && Date.now() >= ban.expiration) {
            ban.expired = true;
            updated = true;
            console.warn(`[BanSystem] Ban expired for ${ban.displayName}`);
        }
    });
    
    if (updated) {
        database.bannedPlayers = database.bannedPlayers.filter(ban => {
            if (ban.expired) {
                return ban.bannedAt > Date.now() - (30 * 24 * 60 * 60 * 1000);
            }
            return true;
        });
        saveBanDatabase(database);
    }
}, 100);

// Block banned players from joining
world.afterEvents.playerJoin.subscribe((event) => {
    const { playerId, playerName } = event;
    
    system.runTimeout(() => {
        const player = world.getPlayers().find(p => p.id === playerId);
        if (!player) return;
        
        const banInfo = isPlayerBanned(playerName);
        if (!banInfo) return;
        
        const expirationText = banInfo.expiration 
            ? `\n§7Expires: §e${new Date(banInfo.expiration).toLocaleString()}`
            : "\n§7Expires: §cNever";
        
        system.run(() => {
            player.runCommand(`kick "${playerName}" §cYou are banned from this server!\n§7Reason: §e${banInfo.reason}\n§7Moderator: §e${banInfo.moderator}${expirationText}`);
        });
    }, 10);
});

Command.register({
    name: "ban",
    description: "",
    aliases: [],
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const { player } = data;
    
    const action = args[0]?.toLowerCase();
    const durationOrTarget = args[1];
    const targetName = args[2];
    const reason = args.slice(3).join(" ") || "No reason specified";

    if (!["add", "list", "remove"].includes(action)) {
        player.sendMessage(`§7[§b#§7] §cInvalid action! §aUse§7: §3!ban §aadd §7[§aduration§7] ${main.player} <§areason§7> §7/ §3!ban §cremove ${main.player} §7/ §3!ban §alist`);
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }

    if (action === "add") {
        if (!targetName) {
            player.sendMessage(`§7[§b#§7] §cPlease specify a player to ban`);
            system.run(() => player.runCommand('playsound random.break @s'));
            return;
        }
    
        if (targetName === player.name || world.getPlayers({ name: targetName, tags: [main.adminTag] }).length > 0) {
            player.sendMessage(`§7[§b#§7] §cYou cannot ban yourself or another admin.`);
            return;
        }

        const durationInMs = parseCustomDuration(durationOrTarget);
        if (durationInMs) {
            if (banPlayer(targetName, reason, player, durationOrTarget)) {
                world.getPlayers({ tags: ["notify"] }).forEach(admin => {
                    admin.sendMessage(`§7[§e#§7] §e${player.name} §ahas banned §e${targetName} §aReason§7: §e${reason}`);
                    system.run(() => admin.runCommand(`playsound note.pling @s`));
                });
            }
        } else {
            if (banPlayer(durationOrTarget, reason, player)) {
                world.getPlayers({ tags: ["notify"] }).forEach(admin => {
                    admin.sendMessage(`§7[§e#§7] §e${player.name} §ahas banned §e${durationOrTarget} §aReason§7: §e${reason}`);
                    system.run(() => admin.runCommand(`playsound note.pling @s`));
                });
            }
        }
    } 
    else if (action === "list") {
        const bannedPlayers = getBannedPlayers();
        if (bannedPlayers.length === 0) {
            player.sendMessage('§7[§b#§7] §cNo players are currently banned.');
            system.run(() => player.runCommand('playsound random.break @s'));
        } else {
            const banList = bannedPlayers.map(p => {
                let expirationText = p.expiration ? `Until ${new Date(p.expiration).toLocaleString()}` : "Permanent";
                return `§e${p.moderator} §7[§gMOD§7] §7| §e${p.name} §aReason§7: ${p.reason} §7(§c${expirationText}§7)`;
            }).join("\n");
            player.sendMessage(`§7[§b#§7] §aBanned Players:\n${banList}`);
        }
    } 
    else if (action === "remove") {
        unbanPlayer(durationOrTarget, player);
    }
});

//
// Ban Item Command
//

const banned_items = "bannedItems";
let bannedItems = [];

system.run(() => {
    const storedBannedItems = world.getDynamicProperty(banned_items);
    if (!storedBannedItems) {
        world.setDynamicProperty(banned_items, JSON.stringify(bannedItems));
    } else {
        bannedItems = JSON.parse(storedBannedItems);
    }
});

function saveBannedItems() {
    world.setDynamicProperty(banned_items, JSON.stringify(bannedItems));
}

Command.register({
    name: "banitem",
    description: "",
    aliases: [],
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const { player } = data;
    
    const action = args[0]?.toLowerCase();
    const itemName = args[1]?.toLowerCase();

    if (!["add", "remove", "list"].includes(action)) {
        player.sendMessage('§7[§b#§7] §cInvalid action! §aUse this Method§7: §3!banitem §aadd §7<§aitem§7> / §3!banitem §cremove §7<§aitem§7> / §3!banitem §alist.');
        return system.run(() => player.runCommand('playsound random.break @s'));
    }

    if (action === "add") {
        if (!itemName) {
            player.sendMessage('§7[§b#§7] §cPlease specify an item to ban.');
            system.run(() => player.runCommand('playsound random.break @s'));
            return;
        }

        const formattedItemName = itemName.startsWith("minecraft:") ? itemName : `minecraft:${itemName}`;

        if (bannedItems.includes(formattedItemName)) {
            player.sendMessage(`§7[§b#§7] §cThe item §e${formattedItemName}§c is already banned.`);
            system.run(() => player.runCommand('playsound random.bell @s'));
            return;
        }
        
        bannedItems.push(formattedItemName);
        saveBannedItems();
        
        player.sendMessage(`§7[§b#§7] §e${formattedItemName} §ahas been added to the banned items list.`);
        system.run(() => player.runCommand('playsound note.bell @s'));

    } else if (action === "remove") {
        if (!itemName) {
            player.sendMessage('§7[§b#§7] §cPlease specify an item to remove from the ban list.');
            system.run(() => player.runCommand('playsound random.break @s'));
            return;
        }

        const formattedItemName = itemName.startsWith("minecraft:") ? itemName : `minecraft:${itemName}`;
        const index = bannedItems.indexOf(formattedItemName);
        if (index === -1) {
            player.sendMessage(`§7[§b#§7] §cThe item §e${formattedItemName}§c is not banned.`);
            system.run(() => player.runCommand('playsound random.break @s'));
            return;
        }

        bannedItems.splice(index, 1);
        saveBannedItems();

        player.sendMessage(`§7[§b#§7] §e${formattedItemName} §ahas been removed from the banned items list.`);
        system.run(() => player.runCommand('playsound note.bell @s'));

    } else if (action === "list") {
        if (bannedItems.length === 0) {
            player.sendMessage('§7[§b#§7] §cThere are no banned items.');
        } else {
            const itemList = bannedItems.map(item => `§e${item}`).join(", ");
            player.sendMessage(`§7[§b#§7] §aBanned items: §e${itemList}`);
        }
        system.run(() => player.runCommand('playsound note.bell @s'));
    }
});

world.afterEvents.itemUse.subscribe((event) => {
    const { source: player, itemStack } = event;

    if (bannedItems.includes(itemStack.typeId)) {
        system.run(() => player.runCommand('clear @s ' + itemStack.typeId));
        player.sendMessage(`§7[§b#§7] §cThe item §e${itemStack.typeId} §chas been banned and removed from your inventory.`);
        system.run(() => player.runCommand('playsound random.break @s'));
        addLog(player.name, "Banned Item", `Tried to use Banned Item: §a${itemStack.typeId.replace("minecraft:", "")}`);
    }
});

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        const inventory = player.getComponent("inventory").container;
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (item && bannedItems.includes(item.typeId)) {
                inventory.setItem(i, null);
                player.sendMessage(`§7[§b#§7] §cThe item §e${item.typeId}§c is banned and has been removed.`);
                system.run(() => player.runCommand('playsound random.break @s'));
                addLog(player.name, "Banned Item", `Tried to use Banned Item: §a${item.typeId.replace("minecraft:", "")}`);
            }
        }
    }
}, 5);

//
// Clear Chat Command
//

Command.register({
    name: "clearchat",
    description: "",
    aliases: ["cc"],
    permission: (player) => player.hasTag(main.adminTag),
}, (data) => {
    const player = data.player;
    
    
    player.sendMessage(`\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n`);
    system.run(() => player.runCommand(`playsound note.bell @s`));
});

//
// CommandBlock False Command
//

Command.register({
    name: "cmdsf",
    description: "",
    aliases: [],
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const player = data.player
    
    const enable = "enable", disable = "disable";
    
    if (disable.includes(args[0])) { 
        system.run(() => player.runCommand(`playsound note.bell @s`));
        system.run(() => player.runCommand('gamerule commandblockoutput false'));
        system.run(() => player.runCommand('gamerule sendcommandfeedback false'));
        player.sendMessage(`§7[§b#§7] §aSuccesfully §cdisabled §aCommand Logs`);
        // Notification for Admins
        world.getPlayers({ tags: ["notify"] }).forEach(admin => {
            admin.sendMessage(`§7[§e#§7] §e${player.name} §ais using §3!cmdsf disable`);
            system.run(() => admin.runCommand(`playsound note.pling @s`));
        });
    } else if (enable.includes(args[0])) {
        system.run(() => player.runCommand(`playsound note.bell @s`));
        system.run(() => player.runCommand('gamerule commandblockoutput true'));
        system.run(() => player.runCommand('gamerule sendcommandfeedback true'));
        player.sendMessage(`§7[§b#§7] §aSuccesfully §3enabled §aCommand Logs`);
        // Notification for Admins
        world.getPlayers({ tags: ["notify"] }).forEach(admin => {
            admin.sendMessage(`§7[§e#§7] §e${player.name} §ais using §3!cmdsf enable`);
            system.run(() => admin.runCommand(`playsound note.pling @s`));
        });
    } else {
        player.sendMessage(`§7[§b#§7] §cInvalid action! §aUse this Method§7: §3!cmdsf ${main.enabledisable}`);
        system.run(() => player.runCommand(`playsound random.break @s`));
    }
});

//
// Ender Chest Wipe Command
//

Command.register({
    name: "ecwipe",
    description: "",
    aliases: [],
    permission: (player) => player.hasTag(main.adminTag),
}, async (data, args) => {
    const player = data.player;
    
    if (!args[0]) {
        player.sendMessage(`§7[§b#§7] §aTry to mention a player to remove there ender_chest. §3!ecwipe ${main.playerl}`);
        return system.run(() => player.runCommand('playsound random.break @s'));
    }

    let targetPlayer;
    try {
        targetPlayer = world.getPlayers().find(p => p.name === args[0]);
    } catch (error) {
        return player.sendMessage(`§7[§b#§7] §aError finding player: ${error.message}`);
    }

    if (!targetPlayer) {
        player.sendMessage('§7[§b#§7] §aPlayer name must be someone currently on the server');
        return system.run(() => player.runCommand('playsound random.break @s'));
    }

    if (targetPlayer === player) {
         player.sendMessage('§7[§b#§7] §cYou cannot clear your own ender_chest.');
         return system.run(() => player.runCommand('playsound random.break @s'));
    }
     if (targetPlayer.hasTag(main.adminTag)) {
         player.sendMessage('§7[§b#§7] §cYou can\'t clear a staff member ender_chest.');
         return system.run(() => player.runCommand('playsound random.break @s'));
    }

    try {
        system.run(() => player.runCommand(`playsound note.bell @s`))
        player.sendMessage(`§7[§b#§7] §aSuccessfully §cremove ender_chest items on §e${targetPlayer.name}.`);
        for (let i = 0; i < 27; i++) system.run(() => player.runCommand(`replaceitem entity "${targetPlayer.name}" slot.enderchest ${i} air`));
        // Notification for Admins
        world.getPlayers({ tags: ["notify"] }).forEach(admin => {
            admin.sendMessage(`§7[§e#§7] §e${player.name} §ais using §3!ecwipe to ${targetPlayer.name}`);
            system.run(() => admin.runCommand(`playsound note.pling @s`));
        });
    } catch (error) {
        player.sendMessage(`§7[§b#§7] §aError adding notify tag: ${error.message}`);
    }
});

//
// Ender Chest See Command
//

Command.register({
    name: "ecsee",
    description: "",
    aliases: [],
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const player = data.player;
    
    if (args.length < 1) {
        player.sendMessage(`§7[§b#§7] §cUse: §3!ecsee <player>`);
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }

    const targetPlayerName = args[0];
    const targetPlayer = world.getPlayers().find(p => p.name === targetPlayerName);

    if (!targetPlayer) {
        player.sendMessage(`§7[§b#§7] §cPlayer not found.`);
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }

    const enderChest = targetPlayer.getComponent("minecraft:ender_inventory")?.container;
    
    if (!enderChest) {
        player.sendMessage(`§7[§b#§7] §cUnable to access ender chest.`);
        return;
    }

    const chestX = Math.floor(player.location.x);
    const chestY = Math.floor(player.location.y) + 2;
    const chestZ = Math.floor(player.location.z);
    
    system.run(() => {
        player.runCommand(`setblock ${chestX} ${chestY} ${chestZ} shulker_box`);
    });
    
    system.runTimeout(() => {
        try {
            const shulkerBlock = player.dimension.getBlock({ x: chestX, y: chestY, z: chestZ });
            
            if (!shulkerBlock) {
                player.sendMessage(`§7[§b#§7] §cBlock not found at location.`);
                return;
            }
            
            const shulkerContainer = shulkerBlock.getComponent("minecraft:inventory")?.container;
            if (!shulkerContainer) {
                system.run(() => player.runCommand(`setblock ${chestX} ${chestY} ${chestZ} air`));
                return;
            }
            
            for (let i = 0; i < enderChest.size; i++) {
                const item = enderChest.getItem(i);
                if (item) {
                    shulkerContainer.setItem(i, item);
                }
            }
            
            system.runTimeout(() => {
                system.run(() => {
                    player.runCommand(`setblock ${chestX} ${chestY} ${chestZ} air destroy`);
                });
                player.sendMessage(`§7[§b#§7] §e${targetPlayerName}'s §aender chest has been sent to you.`);
            }, 5);
            
        } catch (error) {
            player.sendMessage(`§7[§b#§7] §cError: ${error.message}`);
            system.run(() => player.runCommand(`setblock ${chestX} ${chestY} ${chestZ} air`));
        }
    }, 5);

    world.getPlayers({ tags: ["notify"] }).forEach(admin => {
        admin.sendMessage(`§7[§e#§7] §e${player.name} §aused §3!ecsee §aon §e${targetPlayer.name}`);
        system.run(() => admin.runCommand(`playsound note.pling @s`));
    });
});

//
// Give Command
//

Command.register({
  name: "give",
  description: "",
  aliases: ['i'],
  permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
  const player = data.player;
    

  if (args.length < 2) {
        player.sendMessage('§7[§b#§7] §cInvalid action! §aUse this Method§7: §3!give §7<§aitem§7> §7<§aamount§7> §7[§gdata§7]');
        return system.run(() => player.runCommand('playsound random.break @s'));
  }

  const [item, amount, ...dataArgs] = args;
  const dataValue = dataArgs.join(" ") || "0"; // Join remaining args for optional data and default to "0" if not provided

  const parsedAmount = parseInt(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return player.sendMessage('§7[§b#§7] §cAmount must be a valid number greater than 0.');
  }

  system.run(() => player.runCommand(`give @s ${item} ${parsedAmount} ${dataValue}`));
  system.run(() => player.sendMessage(`§7[§b#§7] §aSuccessfully gave yourself §e${parsedAmount} ${item}§a(s).`));
});

//
// Inventory See Command
//

function getInventoryItems(player) {
    let inv = player.getComponent("inventory").container;
    let items = Array.from({ length: inv.size }, (_, i) => inv.getItem(i) || { typeId: "air" });
    return player instanceof Player ? items.slice(9).concat(items.slice(0, 9)) : items;
}

function getArmorItems(player) {
    let equip = player.getComponent("equippable");
    return [equip.getEquipment(EquipmentSlot.Head), equip.getEquipment(EquipmentSlot.Chest), equip.getEquipment(EquipmentSlot.Legs), equip.getEquipment(EquipmentSlot.Feet), equip.getEquipment(EquipmentSlot.Offhand)];
}

function openInventoryUI(target, viewer) {
    viewer.runCommand("ride @s stop_riding");
    
    let items = getInventoryItems(target);
    let armor = getArmorItems(target);
    let entity = viewer.dimension.spawnEntity("bluemods:inventory", viewer.location);
    let container = entity.getComponent("inventory").container;
    
    entity.nameTag = `_blue:inventory:${target.name}`;
    
    for (let i = 0; i < 36; i++) {
        if (items[i]?.typeId !== "air") container.setItem(i, items[i]);
    }
    
    for (let i = 45; i < 53; i++) {
        if (armor[i - 45]?.typeId !== "air") container.setItem(i, armor[i - 45]);
    }
    
    viewer.runCommand("ride @s start_riding @e[type=bluemods:inventory,c=1] teleport_ride");
    entity.addTag("invsee");
}

Command.register({
    name: "invsee",
    description: "View a player's inventory live",
    aliases: [],
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const player = data.player;
   
    let target = world.getPlayers().find(p => p.name === args[0]);
    if (!target) { 
        player.sendMessage("§7[§b#§7] §cPlayer not found."); 
        return; 
    }
    
    system.run(() => openInventoryUI(target, player));
    system.run(() => player.sendMessage("§7[§a+§7] §fPress E or Click your Inventory Button to see the user's Inventory\n§eNote:§f You cannot change, move, or add any items on the player."));
});

//
// Inventory Clear Command
//

Command.register({
    name: "invwipe",
    description: "",
    aliases: ["clear"],
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const player = data.player;
    

    if (args.length < 1) {
        player.sendMessage(`§7[§b#§7] §cInvalid action! §aUse this Method§7: §3!invwipe ${main.player}`);
        return system.run(() => player.runCommand('playsound random.break @s'));
    }

    const targetPlayerName = args[0];
    const targetPlayer = world.getPlayers().find(p => p.name === targetPlayerName);

    if (targetPlayer) {
        system.run(() => player.runCommand(`clear ${targetPlayerName}`));
        system.run(() => player.runCommand(`playsound level.up @s`));
        player.sendMessage(`§7[§b#§7] §aSuccessfully Cleared §e${targetPlayerName}§a's inventory.`);
        // Notification for Admins
        world.getPlayers({ tags: ["notify"] }).forEach(admin => {
            admin.sendMessage(`§7[§e#§7] §e${player.name} §ais using §3!invsee §ato §e${targetPlayer.name}`);
            system.run(() => admin.runCommand(`playsound note.pling @s`));
        });
    } else {
        player.sendMessage(`§7[§b#§7] §aPlayer name must be someone currently on the server`);
        system.run(() => player.runCommand(`playsound random.break @s`));
    }
});

//
// Kick Command
//

Command.register({
    name: "kick",
    description: "",
    aliases: [],
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const player = data.player;
    

    if (args.length < 2) {
        player.sendMessage('§7[§b#§7] §aUse this method to kick the user§7: §3!kick §a<player> <reason>');
        return system.run(() => player.runCommand('playsound random.break @s'));
    }

    const targetPlayerName = args[0];
    const reason = args.slice(1).join(" ");

    let targetPlayer;
    try {
        targetPlayer = world.getPlayers().find(p => p.name === targetPlayerName);
    } catch (error) {
        return player.sendMessage(`§7[§b#§7] §aError finding player: ${error.message}`);
    }
    
    if (!targetPlayer) {
        player.sendMessage('§7[§b#§7] §aPlayer name must be someone currently on the server');
        return system.run(() => player.runCommand('playsound random.break @s'));
    }
    
    if (targetPlayer === player) {
        player.sendMessage('§7[§b#§7] §cYou cannot kick yourself.');
        return system.run(() => player.runCommand('playsound random.break @s'));
    }
    if (targetPlayer.hasTag(main.adminTag)) {
        player.sendMessage('§7[§b#§7] §cYou can\'t kick a staff member.');
        return system.run(() => player.runCommand('playsound random.break @s'));
    }
    
    try {
        system.run(() => player.runCommand(`playsound note.bell @s`));
        player.sendMessage(`§7[§b#§7] §aSuccessfully kicked out §e${targetPlayer.name} §afrom the server for§7: §g${reason}`);
        system.run(() => player.runCommand(`kick "${targetPlayer.name}" "\n§bBlueMods §7>> §aYou have been kicked from the server\n§eModerator§7: §g${player.name}\n§eReason§7: §g${reason}"`));
        // Notification for Admins
        world.getPlayers({ tags: ["notify"] }).forEach(admin => {
            admin.sendMessage(`§7[§e#§7] §e${player.name} §ais using §3!kick §ato §e${targetPlayer.name} §aReason§7: §e${reason}`);
            system.run(() => admin.runCommand(`playsound note.pling @s`));
        });
    } catch (error) {
        player.sendMessage(`§7[§b#§7] §aError executing kick: ${error.message}`);
    }
});

//
// LagClear Command
//

Command.register({
    name: "lagclear",
    description: "",
    aliases: ["lc"],
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const { player } = data;
    
    const action = args[0]?.toLowerCase();
    
    if (!["default", "mobs", "all"].includes(action)) {
        player.sendMessage('§7[§b#§7] §cInvalid action! §aUse this Method§7: §3!lagclear §adefault §7/ §3!lagclear §amobs §7/ §3!lagclear §aall');
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }
    
    if (action === "default") {
        system.run(() => player.runCommand(`kill @e[type=item]`));
        system.run(() => player.runCommand(`kill @e[type=arrow]`));
        system.run(() => player.runCommand(`kill @e[type=xp_orb]`));
        system.run(() => player.runCommand(`playsound note.bell @s`));
        player.sendMessage(`§7[§b#§7] §aSuccesfully use Default§7: §aItem Entities, XP Orbs, Arrows.`);
    } else if (action === "mobs") {
        system.run(() => player.runCommand(`kill @e[type=!player, type=!armor_stand]`));
        system.run(() => player.runCommand(`playsound note.bell @s`));
        player.sendMessage(`§7[§b#§7] §aSuccessfully use Mobs§7: §aMob Entities.`);
    } else if (action === "all") {
        system.run(() => player.runCommand(`kill @e[type=!player]`));
        system.run(() => player.runCommand(`playsound note.bell @s`));
        player.sendMessage(`§7[§b#§7] §aSuccessfully use All§7: §aAll Mob Entities.`);
    }
});

//
// Mute Command
//

Command.register({
    name: "mute",
    description: "",
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const { player } = data;

    if (args.length < 1) {
        player.sendMessage(`§7[§b#§7] §cInvalid action! §aUse: §3!mute §aadd/remove §e<player> §7/ §3!mute §alist`);
        return;
    }

    const action = args[0].toLowerCase();

    if (action === "list") {
        listMutes(player);
        return;
    }

    const targetName = args[1];

    if (!targetName) {
        player.sendMessage(`§7[§b#§7] §cUsage: §3!mute §e${action} <player>`);
        return;
    }

    switch (action) {
        case "add":
            mutePlayer(player, targetName);
            break;
        case "remove":
            unmutePlayer(player, targetName);
            break;
        default:
            player.sendMessage(`§7[§b#§7] §cInvalid action! §aUse: §3!mute §aadd/remove §e<player> §7/ §3!mute §alist`);
            break;
    }
});

// Mute Functions
function mutePlayer(player, targetName) {
    const target = world.getPlayers().find(p => p.name.toLowerCase() === targetName.toLowerCase());
    
    if (!target) {
        player.sendMessage(`§7[§b#§7] §cPlayer §e${targetName} §cnot found!`);
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }
    
    if (target.hasTag("isMuted")) {
        player.sendMessage(`§7[§b#§7] §c${target.name} is already muted!`);
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }
    
    if (target.hasTag(main.adminTag)) {
        player.sendMessage(`§7[§b#§7] §cYou cannot mute another admin!`);
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }
    
    target.addTag("isMuted");
    target.sendMessage(`§7[§c!§7] §cYou have been muted by §e${player.name}§c.`);
    player.sendMessage(`§7[§b#§7] §aSuccessfully muted §e${target.name}§a.`);
    system.run(() => player.runCommand('playsound note.bell @s'));
    
    world.getPlayers({ tags: ["notify"] }).forEach(admin => {
        admin.sendMessage(`§7[§e#§7] §e${player.name} §ahas muted §e${target.name}`);
        system.run(() => admin.runCommand(`playsound note.pling @s`));
    });
}

function unmutePlayer(player, targetName) {
    const target = world.getPlayers().find(p => p.name.toLowerCase() === targetName.toLowerCase());
    
    if (!target) {
        player.sendMessage(`§7[§b#§7] §cPlayer §e${targetName} §cnot found!`);
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }
    
    if (!target.hasTag("isMuted")) {
        player.sendMessage(`§7[§b#§7] §c${target.name} is not muted!`);
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }
    
    target.removeTag("isMuted");
    target.sendMessage(`§7[§a!§7] §aYou have been unmuted by §e${player.name}§a.`);
    player.sendMessage(`§7[§b#§7] §aSuccessfully unmuted §e${target.name}§a.`);
    system.run(() => player.runCommand('playsound note.bell @s'));
    
    world.getPlayers({ tags: ["notify"] }).forEach(admin => {
        admin.sendMessage(`§7[§e#§7] §e${player.name} §ahas unmuted §e${target.name}`);
        system.run(() => admin.runCommand(`playsound note.pling @s`));
    });
}

function listMutes(player) {
    const mutedPlayers = world.getPlayers({ tags: ["isMuted"] });
    
    if (mutedPlayers.length === 0) {
        player.sendMessage(`§7[§b#§7] §aNo players are currently muted.`);
        return;
    }
    
    const muteList = mutedPlayers.map(p => `§e${p.name}`).join("\n");
    player.sendMessage(`§7[§b#§7] §aMuted Players §7(${mutedPlayers.length}):\n${muteList}`);
}

//
// Notify Command
//

Command.register({
    name: "notify",
    description: "",
    aliases: [],
    permission: (player) => (player.hasTag(main.adminTag))
}, async (data, args) => {
    const player = data.player;
    
    const action = args[0]?.toLowerCase();
    const targetName = args[1] || player.name;
    const [targetPlayer] = world.getPlayers({ name: targetName });
    
    if (action === "list") {
        const notifyPlayers = world.getPlayers().filter(p => p.hasTag('notify')).map(p => p.name).join(', ');
        player.sendMessage(`§7[§b#§7] §aNotify List: §e${notifyPlayers || 'No notify player found'}`);
        return;
    }

    if (!["add", "remove"].includes(action)) {
        player.sendMessage(`§7[§b#§7] §cInvalid action! §aUse this Method§7: §3!notify §aadd ${main.player} §7/ §3!notify §cremove ${main.player} §7/ §3!notify §alist`);
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }

    if (!targetPlayer) {
        player.sendMessage('§7[§b#§7] §aPlayer not found! Please specify a valid player name.');
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }

    try {
        if (action === "add") {
            if (!targetPlayer.hasTag("notify")) {
                await system.run(() => targetPlayer.addTag("notify"));
                system.run(() => player.runCommand(`playsound note.bell @s`));
                player.sendMessage(`§7[§b#§7] §aSuccessfully §3added §anotify status to §e${targetPlayer.name}`);
                
            } else {
                player.sendMessage(`§7[§b#§7] §c${targetPlayer.name} already has notify status.`);
            }
        } else if (action === "remove") {
            if (targetPlayer.hasTag("notify")) {
                await system.run(() => targetPlayer.removeTag("notify"));
                system.run(() => player.runCommand(`playsound note.bell @s`));
                player.sendMessage(`§7[§b#§7] §aSuccessfully §cremoved §anotify status from §e${targetPlayer.name}`);
                
            } else {
                player.sendMessage(`§7[§b#§7] §c${targetPlayer.name} does not have notify status.`);
            }
        }
    } catch (error) {
        player.sendMessage(`§7[§b#§7] §cError modifying player tags: ${error.message}`);
    }
});

//
// OP Command
//

Command.register({
    name: "op",
    description: "",
    aliases: [],
    permission: (player) => (player.hasTag(main.adminTag))
}, async (data, args) => {
    const player = data.player;
    
    const action = args[0]?.toLowerCase(); // First argument: add, remove, or list
    const targetName = args[1] || player.name; // Second argument: target player's name, default to the command executor
    const [targetPlayer] = world.getPlayers({ name: targetName });
    
    if (action === "list") {
        const adminPlayers = world.getPlayers().filter(p => p.hasTag('admin')).map(p => p.name).join(', ');
        player.sendMessage(`§7[§b#§7] §aAdmins: §e${adminPlayers || 'No admins found'}`);
        return;
    }

    if (!["add", "remove"].includes(action)) {
        player.sendMessage(`§7[§b#§7] §cInvalid action! §aUse this Method§7: §3!op §aadd ${main.player} §7/ §3!op §cremove ${main.player} §7/ §3!op §alist`);
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }

    if (!targetPlayer) {
        player.sendMessage('§7[§b#§7] §aPlayer not found! Please specify a valid player name.');
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }

    try {
        if (action === "add") {
            if (!targetPlayer.hasTag("admin")) {
                await system.run(() => targetPlayer.addTag("admin"));
                system.run(() => player.runCommand(`playsound note.bell @s`));
                player.sendMessage(`§7[§b#§7] §aSuccessfully §3added §aadmin status to §e${targetPlayer.name}`);
                
            } else {
                player.sendMessage(`§7[§b#§7] §c${targetPlayer.name} already has admin status.`);
            }
        } else if (action === "remove") {
            if (targetPlayer.hasTag("admin")) {
                await system.run(() => targetPlayer.removeTag("admin"));
                system.run(() => player.runCommand(`playsound note.bell @s`));
                player.sendMessage(`§7[§b#§7] §aSuccessfully §cremoved §aadmin status from §e${targetPlayer.name}`);
                
            } else {
                player.sendMessage(`§7[§b#§7] §c${targetPlayer.name} does not have admin status.`);
            }
        }
    } catch (error) {
        player.sendMessage(`§7[§b#§7] §cError modifying player tags: ${error.message}`);
    }
});

//
// Golden Apple Command
//


system.runInterval(() => {
    const currentTick = system.currentTick;

    for (const player of world.getPlayers()) {
        const playerName = player.name;
        const cooldownEndTick = playerCooldowns.get(playerName);

        if (cooldownEndTick && currentTick >= cooldownEndTick) {
            player.sendMessage("§7[§b#§7] §aYou can now use Ender Pearls again!");
            system.run(() => player.runCommand(`playsound note.bell @s`));
            playerCooldowns.delete(playerName);
        }
    }
}, 20);

world.beforeEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const { itemStack } = event;
    const playerName = player.name;
    const currentTick = system.currentTick;

    if (itemStack.typeId === "minecraft:ender_pearl") {
        if (!isCommandEnabled("pearl")) return;
        handleCooldown(player, event, "pearl", main.pearlCooldown, "Ender Pearl");
    }
    else if (itemStack.typeId === "minecraft:golden_apple") {
        if (!isCommandEnabled("gapple")) return;
        handleCooldown(player, event, "golden_apple", main.goldenAppleCooldown, "Golden Apple");
    }
    else if (itemStack.typeId === "minecraft:enchanted_golden_apple" || itemStack.typeId === "minecraft:golden_apple_enchanted") {
        if (!isCommandEnabled("gapple")) return;
        handleCooldown(player, event, "enchanted_apple", main.enchantedAppleCooldown, "Enchanted Golden Apple");
    }
});

function handleCooldown(player, event, itemKey, cooldownSeconds, itemName) {
    const playerName = player.name;
    const currentTick = system.currentTick;
    const cooldownKey = `${playerName}_${itemKey}`;

    if (playerCooldowns.has(cooldownKey)) {
        const cooldownEndTick = playerCooldowns.get(cooldownKey);

        if (currentTick < cooldownEndTick) {
            const remainingTicks = cooldownEndTick - currentTick;
            const remainingSeconds = Math.ceil(remainingTicks / 20);

            player.sendMessage(`§7[§b#§7] §cYou are on cooldown for using ${itemName}! Please wait §e${remainingSeconds} §cseconds.`);
            system.run(() => player.runCommand(`playsound random.break @s`));
            
            event.cancel = true;
            return;
        }
    }

    const cooldownTicks = cooldownSeconds * 20;
    playerCooldowns.set(cooldownKey, currentTick + cooldownTicks);
    player.sendMessage(`§7[§b#§7] §a${itemName} used! You are now on a ${cooldownSeconds}-second cooldown.`);
}

Command.register({
    name: "gapple",
    description: "",
    aliases: [],
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const { player } = data;
    
    const type = args[0]?.toLowerCase();
    const action = args[1]?.toLowerCase();
    const duration = parseInt(args[2]);

    if (!["golden", "enchanted"].includes(type)) {
        player.sendMessage('§7[§b#§7] §cInvalid type! Use: §3!gapple §egolden §7/ §3!gapple §eenchanted');
        return system.run(() => player.runCommand('playsound random.break @s'));
    }

    if (!["set", "remove"].includes(action)) {
        player.sendMessage('§7[§b#§7] §cInvalid action! Use: §3!gapple §e<type> §aset §7<§aseconds§7> §7/ §3!gapple §e<type> §cremove');
        return system.run(() => player.runCommand('playsound random.break @s'));
    }

    if (type === "golden") {
        if (action === "set") {
            if (isNaN(duration) || duration < main.goldenAppleMinCooldown) {
                player.sendMessage(`§7[§b#§7] §cInvalid duration! It must be at least §e${main.goldenAppleMinCooldown} §cseconds.`);
                return system.run(() => player.runCommand('playsound random.break @s'));
            }
            main.goldenAppleCooldown = duration;
            player.sendMessage(`§7[§b#§7] §aGolden Apple cooldown set to §e${duration} §aseconds.`);
        } else if (action === "remove") {
            main.goldenAppleCooldown = 10;
            player.sendMessage(`§7[§b#§7] §aGolden Apple cooldown reset to default §e${main.goldenAppleCooldown} §aseconds.`);
        }
    } else if (type === "enchanted") {
        if (action === "set") {
            if (isNaN(duration) || duration < main.enchantedAppleMinCooldown) {
                player.sendMessage(`§7[§b#§7] §cInvalid duration! It must be at least §e${main.enchantedAppleMinCooldown} §cseconds.`);
                return system.run(() => player.runCommand('playsound random.break @s'));
            }
            main.enchantedAppleCooldown = duration;
            player.sendMessage(`§7[§b#§7] §aEnchanted Golden Apple cooldown set to §e${duration} §aseconds.`);
        } else if (action === "remove") {
            main.enchantedAppleCooldown = 30;
            player.sendMessage(`§7[§b#§7] §aEnchanted Golden Apple cooldown reset to default §e${main.enchantedAppleCooldown} §aseconds.`);
        }
    }
    
    system.run(() => player.runCommand('playsound random.levelup @s'));
});

//
// Pearl Command
//

const playerCooldowns = new Map();

Command.register({
    name: "pearl",
    description: "",
    aliases: [],
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const { player } = data;
    
    const action = args[0]?.toLowerCase();
    const duration = parseInt(args[1]);

    if (!["set", "remove"].includes(action)) {
        player.sendMessage('§7[§b#§7] §cInvalid action! Use: §3!pearl §eset §7<§aseconds§7> §7/ §3!pearl §cremove');
        return system.run(() => player.runCommand('playsound random.break @s'));
    }

    if (action === "set") {
        if (isNaN(duration) || duration < main.pearlMinCooldown) {
            player.sendMessage(`§7[§b#§7] §cInvalid duration! It must be at least §e${main.pearlMinCooldown} §cseconds.`);
            return system.run(() => player.runCommand('playsound random.break @s'));
        }

        main.pearlCooldown = duration;
        player.sendMessage(`§7[§b#§7] §aEnder Pearl cooldown set to §e${duration} §aseconds.`);
        system.run(() => player.runCommand('playsound random.levelup @s'));

    } else if (action === "remove") {
        main.pearlCooldown = 10;
        player.sendMessage(`§7[§b#§7] §aEnder Pearl cooldown reset to default §e${main.pearlCooldown} §aseconds.`);
        system.run(() => player.runCommand('playsound random.levelup @s'));
    }
});

//
// Ranks Command
//

Command.register({
    name: "rank",
    description: "",
    aliases: [],
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const { player } = data;

    if (args.length < 3 || args.length > 4) {
        player.sendMessage(`§7[§b#§7] §cInvalid action! §aUse this Method§7: §3!rank ${main.addremove} §7<§arank§7> §7[§gcolor(optional)§7] ${main.player}`);
        return system.run(() => player.runCommand(`playsound random.break @s`));
    }

    const action = args[0].toLowerCase();
    const rankName = args[1];
    let rankColor = main.colors.white; // default color

    if (args.length === 4) {
        const colorName = args[2].toLowerCase();
        if (main.colors[colorName]) {
            rankColor = main.colors[colorName];
        } else {
            player.sendMessage(`§7[§b#§7] §cInvalid color! §aAvailable colors§7: §0black §7| §1dark_blue §7| §2dark_green §7| §3dark_aqua §7| §4dark_red §7| §5dark_purple §7| §6gold §7| §7gray §7| §8dark_gray §7| §9blue §7| §agreen §7| §baqua §7| §cred §7| §dlight_purple §7| §eyellow §7| §fwhite`); ///////////////
            return system.run(() => player.runCommand(`playsound random.break @s`));
        }
    }

    const playerName = args[args.length - 1];
    const targetPlayer = [...world.getPlayers()].find(player => player.name === playerName);

    if (!targetPlayer) {
        player.sendMessage(`§7[§b#§7] §cPlayer "${playerName}" not found.`);
        return system.run(() => player.runCommand(`playsound random.break @s`));
    }

    let ranks = targetPlayer.getTags().filter(tag => tag.startsWith("rank:"));

    if (action === "add") {
        if (ranks.length >= 3) {
            player.sendMessage("§7[§b#§7] §cThe player already has the maximum of 3 ranks.");
            return system.run(() => player.runCommand(`playsound random.break @s`));
        }
        system.run(() => targetPlayer.runCommand(`tag "${playerName}" add "rank:${rankColor}${rankName}"`));
        player.sendMessage(`§7[§b#§7] §aAdded rank "${rankColor}${rankName}§a" to ${playerName}.`);
        system.run(() => player.runCommand(`playsound note.bell @s`));
    } else if (action === "remove") {
        const rankToRemove = `rank:${rankColor}${rankName}`;
        if (!ranks.includes(rankToRemove)) {
            player.sendMessage(`§7[§b#§7] §cThe player does not have the rank "${rankColor}${rankName}§c".`);
            return system.run(() => player.runCommand(`playsound random.break @s`));
        }
        system.run(() => targetPlayer.runCommand(`tag "${playerName}" remove "${rankToRemove}"`));
        player.sendMessage(`§7[§b#§7] §aRemoved rank "${rankColor}${rankName}§a" from ${playerName}.`);
        system.run(() => player.runCommand(`playsound random.bell @s`));
    } else {
        player.sendMessage("§7[§b#§7] §cInvalid action! §aUse 'add' or 'remove'.");
        return system.run(() => player.runCommand(`playsound random.break @s`));
    }
});

//
// Troll Command
//

const cooldowns = {};

Command.register({
    name: "troll",
    description: "",
    aliases: [],
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const { player } = data;
    
    const { id, name } = player;
    const trollTypes = ["creeper", "endermen", "ghast", "zombie", "skeleton"];
    const COOLDOWN_TIME = 10000;

    const currentTime = Date.now();
    if (cooldowns[id] && currentTime - cooldowns[id] < COOLDOWN_TIME) {
        const remainingTime = ((COOLDOWN_TIME - (currentTime - cooldowns[id])) / 1000).toFixed(1);
        player.sendMessage(`§7[§b#§7] §aPlease wait §e${remainingTime}s §abefore using the troll command again.`);
        return system.run(() => player.runCommand('playsound random.break @s'));
    }

    if (args.length < 2) {
        player.sendMessage('§7[§b#§7] §cInvalid action! §aUse this Method§7: !troll <troll> <player>');
        player.sendMessage('§7[§b#§7] §aTroll list §7(§ecreeper§7/§eendermen§7/§eghast§7/§ezombie§7/§eskeleton§7)');
        return system.run(() => player.runCommand('playsound random.break @s'));
    }

    const trollType = args[0];
    const targetPlayerName = args[1];

    if (!trollTypes.includes(trollType)) {
        player.sendMessage('§7[§b#§7] §aInvalid troll type. You have to choose one of these §7(§ecreeper§7/§eendermen§7/§eghast§7/§ezombie§7/§eskeleton§7)');
        return system.run(() => player.runCommand('playsound random.break @s'));
    }

    const targetPlayer = world.getPlayers().find(p => p.name === targetPlayerName);
    if (!targetPlayer) {
        player.sendMessage(`§7[§b#§7] §cCan\'t find the player§7: §e${targetPlayerName}`);
        return system.run(() => player.runCommand('playsound random.break @s'));
    }

    switch (trollType) {
        case "creeper":
            player.sendMessage(`§7[§b#§7] §aSuccessfully sent a creeper troll to§7: §e${targetPlayerName}`);
            system.run(() => player.runCommand(`playsound random.fuse "${targetPlayerName}"`));
            break;
        case "endermen":
            player.sendMessage(`§7[§b#§7] §aSuccessfully sent an endermen troll to§7: §e${targetPlayerName}`);
            system.run(() => player.runCommand(`playsound mob.endermen.scream "${targetPlayerName}"`));
            break;
        case "ghast":
            player.sendMessage(`§7[§b#§7] §aSuccessfully sent a ghast troll to§7: §e${targetPlayerName}`);
            system.run(() => player.runCommand(`playsound mob.ghast.scream "${targetPlayerName}"`));
            break;
        case "zombie":
            player.sendMessage(`§7[§b#§7] §aSuccessfully sent a zombie troll to§7: §e${targetPlayerName}`);
            system.run(() => player.runCommand(`playsound mob.zombie.say "${targetPlayerName}"`));
            break;
        case "skeleton":
            player.sendMessage(`§7[§b#§7] §aSuccessfully sent a skeleton troll to§7: §e${targetPlayerName}`);
            system.run(() => player.runCommand(`playsound mob.skeleton.say "${targetPlayerName}"`));
            break;
    }

    cooldowns[id] = currentTime;
});

//
// Trusted Command
//

Command.register({
    name: "trusted",
    description: "",
    aliases: [],
    permission: (player) => (player.hasTag(main.adminTag) || player.isOp())
}, async (data, args) => {
    const player = data.player;
    
    const action = args[0]?.toLowerCase();
    const targetName = args[1] || player.name;
    const [targetPlayer] = world.getPlayers({ name: targetName });
    
    if (action === "list") {
        const trustedPlayers = world.getPlayers().filter(p => p.hasTag('trusted')).map(p => p.name).join(', ');
        player.sendMessage(`§7[§b#§7] §aTrusted List: §e${trustedPlayers || 'No trusted player found'}`);
        return;
    }

    if (!["add", "remove"].includes(action)) {
        player.sendMessage(`§7[§b#§7] §cInvalid action! §aUse this Method§7: §3!trusted §aadd ${main.player} §7/ §3!trusted §cremove ${main.player} §7/ §3!trusted §alist`);
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }

    if (!targetPlayer) {
        player.sendMessage('§7[§b#§7] §aPlayer not found! Please specify a valid player name.');
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }

    try {
        if (action === "add") {
            if (!targetPlayer.hasTag("trusted")) {
                await system.run(() => targetPlayer.addTag("trusted"));
                system.run(() => player.runCommand(`playsound note.bell @s`));
                player.sendMessage(`§7[§b#§7] §aSuccessfully §3added §atrusted status to §e${targetPlayer.name}`);
                
            } else {
                player.sendMessage(`§7[§b#§7] §c${targetPlayer.name} already has trusted status.`);
            }
        } else if (action === "remove") {
            if (targetPlayer.hasTag("trusted")) {
                await system.run(() => targetPlayer.removeTag("trusted"));
                system.run(() => player.runCommand(`playsound note.bell @s`));
                player.sendMessage(`§7[§b#§7] §aSuccessfully §cremoved §atrusted status from §e${targetPlayer.name}`);
                
            } else {
                player.sendMessage(`§7[§b#§7] §c${targetPlayer.name} does not have trusted status.`);
            }
        }
    } catch (error) {
        player.sendMessage(`§7[§b#§7] §cError modifying player tags: ${error.message}`);
    }
});

//
// Welcome Command
//

const WELCOME_MESSAGE_KEY = "welcomeMessage";
const LEAVE_MESSAGE_KEY = "leaveMessage";
const WELCOME_TOGGLE_KEY = "welcomeToggle";
const LEAVE_TOGGLE_KEY = "leaveToggle";

const defaultSimpleJoinMessage = `§7[§a+§7] §e{name} §ajoined the server`;
const defaultSimpleLeaveMessage = `§7[§c-§7] §e{name} §cleft the server`;
const defaultCustomJoinMessage = `§bBlueMods §7>> §e{name}§a has joined the server.`;
const defaultCustomLeaveMessage = `§bBlueMods §7>> §e{name} §chas left the server.`;

let welcomeMessage = defaultCustomJoinMessage;
let leaveMessage = defaultCustomLeaveMessage;
let welcomeEnabled = false;
let leaveEnabled = false;

system.run(() => {
    const storedWelcomeMessage = world.getDynamicProperty(WELCOME_MESSAGE_KEY);
    const storedLeaveMessage = world.getDynamicProperty(LEAVE_MESSAGE_KEY);
    const storedWelcomeToggle = world.getDynamicProperty(WELCOME_TOGGLE_KEY);
    const storedLeaveToggle = world.getDynamicProperty(LEAVE_TOGGLE_KEY);

    welcomeMessage = storedWelcomeMessage || defaultCustomJoinMessage;
    leaveMessage = storedLeaveMessage || defaultCustomLeaveMessage;
    welcomeEnabled = storedWelcomeToggle === true;
    leaveEnabled = storedLeaveToggle === true;
});

function saveWelcomeMessage(message) {
    world.setDynamicProperty(WELCOME_MESSAGE_KEY, message);
}

function saveLeaveMessage(message) {
    world.setDynamicProperty(LEAVE_MESSAGE_KEY, message);
}

function saveWelcomeToggle(enabled) {
    world.setDynamicProperty(WELCOME_TOGGLE_KEY, enabled);
}

function saveLeaveToggle(enabled) {
    world.setDynamicProperty(LEAVE_TOGGLE_KEY, enabled);
}

world.afterEvents.playerJoin.subscribe((event) => {
    const { playerName } = event;

    if (welcomeEnabled) {
        const formattedMessage = welcomeMessage.replace("{name}", playerName);
        world.sendMessage(formattedMessage);
    } else {
        const formattedMessage = defaultSimpleJoinMessage.replace("{name}", playerName);
        world.sendMessage(formattedMessage);
    }
});

world.afterEvents.playerLeave.subscribe((event) => {
    const { playerName } = event;

    if (leaveEnabled) {
        const formattedMessage = leaveMessage.replace("{name}", playerName);
        world.sendMessage(formattedMessage);
    } else {
        const formattedMessage = defaultSimpleLeaveMessage.replace("{name}", playerName);
        world.sendMessage(formattedMessage);
    }
});

Command.register({
    name: "welcome",
    description: "",
    aliases: [],
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const { player } = data;

    const action = args[0]?.toLowerCase();
    const type = args[1]?.toLowerCase();
    const customMessage = args.slice(2).join(" ");

    if (action === "disable") {
        welcomeEnabled = false;
        leaveEnabled = false;
        saveWelcomeToggle(false);
        saveLeaveToggle(false);
        player.sendMessage("§7[§b#§7] §cCustom welcome/leave messages disabled. Using default simple messages.");
    } else if (action === "enable") {
        welcomeEnabled = true;
        leaveEnabled = true;
        saveWelcomeToggle(true);
        saveLeaveToggle(true);
        player.sendMessage("§7[§b#§7] §aCustom welcome/leave messages enabled.");
    } else if (action === "set") {
        if (!["join", "leave"].includes(type) || !customMessage) {
            player.sendMessage(`§7[§b#§7] §cInvalid usage! Use: §3!welcome set <join|leave> <message>`);
            return;
        }

        if (type === "join") {
            welcomeMessage = customMessage;
            saveWelcomeMessage(welcomeMessage);
            player.sendMessage(`§7[§b#§7] §aJoin message set to: §e${welcomeMessage}`);
        } else if (type === "leave") {
            leaveMessage = customMessage;
            saveLeaveMessage(leaveMessage);
            player.sendMessage(`§7[§b#§7] §aLeave message set to: §e${leaveMessage}`);
        }
    } else if (action === "default") {
        welcomeMessage = defaultCustomJoinMessage;
        leaveMessage = defaultCustomLeaveMessage;
        saveWelcomeMessage(welcomeMessage);
        saveLeaveMessage(leaveMessage);
        player.sendMessage("§7[§b#§7] §aMessages reset to default BlueMods format.");
    } else {
        player.sendMessage(
            "§7[§b#§7] §cInvalid command!\n" +
            "§3!welcome enable §7- Enable custom messages\n" +
            "§3!welcome disable §7- Use simple messages\n" +
            "§3!welcome set <join|leave> <message> §7- Set custom message\n" +
            "§3!welcome default §7- Reset to default"
        );
    }
});

//
// cmdtoggle Command
//

const enabledCommandsKey = "enabledCommands";

export function saveEnabledCommands() {
    const commandsString = JSON.stringify(main.enabledCommands);
    world.setDynamicProperty(enabledCommandsKey, commandsString);
}

export function loadEnabledCommands() {
    const savedCommandsString = world.getDynamicProperty(enabledCommandsKey);
    if (savedCommandsString) {
        try {
            const savedCommands = JSON.parse(savedCommandsString);
            main.enabledCommands = savedCommands;
        } catch (error) {
            console.error(`Failed to load enabled commands: ${error}`);
        }
    }
}

Command.register({
    name: "cmdtoggle",
    description: "",
    aliases: [],
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const { player } = data;
    const action = args[0]?.toLowerCase();
    const commandName = args[1]?.toLowerCase();
    const commandActions = ["enable", "disable", "list"];

    if (!action || !commandActions.includes(action)) {
        player.sendMessage(`§7[§b#§7] §cInvalid action! §aUse: §3!cmdtoggle enable|disable <command> / !cmdtoggle list`);
        system.run(() => player.runCommand(`playsound random.break @s`));
        return;
    }

    if (action === "list") {
        let commandList = "\n§l§eCommands Toggles List:§r\n";
        let commandNumber = 1;

        for (const [command, enabled] of Object.entries(main.enabledCommands)) {
            commandList += `§7[§e${commandNumber}§7] [${enabled ? "§aENABLED" : "§cDISABLED"}§7] §e${command}\n`;
            commandNumber++;
        }

        player.sendMessage(commandList);
        system.run(() => player.runCommand(`playsound note.bell @s`));
        return;
    }

    if (!(commandName in main.enabledCommands)) {
        player.sendMessage(`§7[§b#§7] §cInvalid command name. Command §e${commandName} §cis not recognized.`);
        return;
    }

    if (action === "enable") {
        if (main.enabledCommands[commandName]) {
            player.sendMessage(`§7[§b#§7] §cCommand §e${commandName} §cis already enabled.`);
            system.run(() => player.runCommand(`playsound random.break @s`));
        } else {
            main.enabledCommands[commandName] = true;
            saveEnabledCommands();
            player.sendMessage(`§7[§b#§7] §aCommand §e${commandName} §ahas been enabled.`);
            system.run(() => player.runCommand(`playsound note.bell @s`));
        }
    } else if (action === "disable") {
        if (!main.enabledCommands[commandName]) {
            player.sendMessage(`§7[§b#§7] §cCommand §e${commandName} §cis already disabled.`);
            system.run(() => player.runCommand(`playsound random.break @s`));
        } else {
            main.enabledCommands[commandName] = false;
            saveEnabledCommands();
            player.sendMessage(`§7[§b#§7] §aCommand §e${commandName} §ahas been disabled.`);
            system.run(() => player.runCommand(`playsound note.bell @s`));
        }
    }
});

system.runTimeout(loadEnabledCommands, 0);

//
// Floating Text Command
//

Command.register({
    name: "floatingtext",
    description: "",
    aliases: ["ft"],
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const player = data.player;

    const fullArgs = data.message.split(" ");
    if (fullArgs.length < 2) {
        player.sendMessage("§7[§b#§7] §cInvalid action! §aUse this method§7: §3!floatingtext §7<§atext§7> §7[§gx, y, z§7]");
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }

    if (!data.message.includes("\"")) {
        player.sendMessage("§7[§b#§7] §cError: Text must be enclosed in quotation marks (\")");
        player.sendMessage("§7[§b#§7] §cInvalid action! §aUse this Method§7: §3!floatingtext \"Your text here\" §7[§gx, y, z§7]");
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }

    const textMatch = data.message.match(/"([^"]*)"/);
    if (!textMatch) {
        player.sendMessage("§7[§a-§7] §cError: Could not parse text. Make sure to use proper quotation marks");
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }

    let text = textMatch[1];
    text = text.replace(/\\n/g, '\n');
    
    const remainingArgs = data.message.slice(textMatch.index + textMatch[0].length).trim().split(" ").filter(arg => arg);

    let x = "~";
    let y = "~1";
    let z = "~";

    if (remainingArgs.length >= 3) {
        x = remainingArgs[0];
        y = remainingArgs[1];
        z = remainingArgs[2];
    }

    try {
        system.run(() => {
          player.runCommand(`summon bluemods:ft ${x}${y}${z} ~~ minecraft:become_neutral "${text}"`);
        });
        player.sendMessage(`§7[§b#§7] §aAdded floating text at ${x} ${y} ${z}`);
    } catch (e) {
        player.sendMessage("§7[§c#§7] §cFailed to create floating text. Please check your coordinates.");
        console.warn(`Floating text summon failed: ${e}`);
    }
});