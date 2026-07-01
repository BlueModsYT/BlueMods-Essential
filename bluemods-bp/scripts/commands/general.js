import { world, system } from "@minecraft/server";
import { Command } from "../handler/CommandHandler.js";
import { sendTeleportRequest, acceptTeleportRequest, declineTeleportRequest, blockPlayer, unblockPlayer } from "../main/selection/playerTeleport.js";
import { showRandomTPUI } from "../main/selection/playerRandomTP.js";
import main from "../config.js";

//░███░░██░░██░░█░████░██░░██░░████░░████░░░███░
//░█░░█░█░░░░█░░█░█░░░░██░░██░█░░░█░░█░░░█░█░░█░
//░███░░█░░░░█░░█░███░░██░░██░█░░░░█░█░░░█░██░░░
//░█░░█░█░░░░█░░█░█░░░░█░██░█░█░░░░█░█░░░█░░░█░░
//░█░░█░█░░█░█░░█░█░░█░█░██░█░█░░░█░░█░░░█░█░░█░
//░███░░████░███░░████░█░█░░█░░███░░░████░░███░░
// https://dsc.gg/bluemods

const teleportingPlayers = new Map();
const home_dynamic_property = "playerHome";
const max_home_slots = 6;
const playerRequest = {};
const cooldowns = {};
const tpablocks = {};
const teleport_countdown = 5;

//
// Help Command
//

Command.register({
    name: "help",
    description: "",
    aliases: ["?"]
}, (data, args) => {
    const player = data.player;

    const page = args[0] ? parseInt(args[0]) : 1;

    if (isNaN(page) || page < 1) {
        player.sendMessage("§7[§c-§7] §cInvalid page number. Please use a number greater than or equal to 1.");
        system.run(() => player.runCommand(`playsound random.break @s`));
        return;
    }

    const categories = player.hasTag(main.adminTag) ? main.adminCategories : main.memberCategories;

    displayCategory(player, categories, page);

    world.getPlayers({ tags: [main.notifyTag] }).forEach(admin => {
        admin.sendMessage(`§7[§e#§7] §e${player.name} §ais using §3!help §afor ${player.hasTag(main.adminTag) ? "admins" : "members"}`);
        system.run(() => admin.runCommand(`playsound note.pling @s`));
    });
});

function displayCategory(player, categories, page) {
    const categoryIndex = page - 1;
    if (categoryIndex >= categories.length) {
        player.sendMessage("§7[§c-§7] §cInvalid page number.");
        system.run(() => player.runCommand(`playsound random.break @s`));
        return;
    }

    const category = categories[categoryIndex];
    
    player.sendMessage({ translate: category.name });

    for (const command of category.commands) {
        if (typeof command === "string") {
            player.sendMessage(command);
        } else if (typeof command === "object") {
            player.sendMessage({
                rawtext: [
                    { text: command.text || "" },
                    { translate: command.description }
                ]
            });
        }
    }

    // player.sendMessage(`\n§7You're in Page: §a${page}§7/§a${categories.length} §7| Use §a!help <page> §7to view other categories.\n`);
    player.sendMessage({
        rawtext: [
            { text: "\n§7" },
            { translate: "bluemods.page.info", with: [
                `§a${page}§7`,
                `§a${categories.length}§7`
            ]},
            { text: "\n" }
        ]
    });
    system.run(() => player.runCommand(`playsound note.pling @s`));
}

//
// About Command
//

Command.register({
    name: "about",
    description: "",
    aliases: []
}, (data) => {
    const player = data.player
    
    system.run(() => data.player.runCommand(`playsound note.bell @s`))
    data.player.sendMessage(`${main.developer}`)
    // Notification for Admins:
    world.getPlayers({ tags: ["notify"] }).forEach(admin => {
        admin.sendMessage(`§7[§e#§7] §e${player.name} §ais using §3!about`);
        system.run(() => admin.runCommand(`playsound note.pling @s`));
    });
});

//
// Home Command
//

import { showHomeUI, teleportHomeFromCommand, setHomeFromCommand, removeHomeFromCommand, listHomesFromCommand } from "../main/selection/playerHomes.js";

Command.register({
    name: "home",
    description: "",
    aliases: [],
}, (data, args) => {
    const { player } = data;

    const action = args[0]?.toLowerCase();
    const homeName = args[1];

    if (!action) {
        player.sendMessage(`§7[§b#§7] §cInvalid action! §aUse§7: §3!home §7<§atp§7/§eset§7/§cremove§7/§blist§7> §7<§ehomeName§7>`);
        return;
    }

    switch (action) {
        case "tp":
            teleportHomeFromCommand(player, homeName);
            break;
        case "set":
            setHomeFromCommand(player, homeName);
            break;
        case "remove":
            removeHomeFromCommand(player, homeName);
            break;
        case "list":
            listHomesFromCommand(player);
            break;
        default:
            player.sendMessage(`§7[§b#§7] §cUnknown action: §e${action}§c. Use §3!home <tp/set/remove/list>`);
    }
});

//
// Ping Command
//

Command.register({
    name: "ping",
    description: "",
    aliases: [],
}, async (data) => {
    const { player } = data;

    await system.waitTicks(1);

    const start = Date.now();

    player.runCommand("testfor @s");

    const responseTime = Date.now() - start;

    let pingStatus = "§aLow";
    if (responseTime > 100) {
        pingStatus = "§cHigh";
    } else if (responseTime > 50) {
        pingStatus = "§eMedium";
    }

    const worldTPS = 20;

    player.sendMessage(`§7[§a#§7] §aPing§7: §e${responseTime}ms §7[${pingStatus}§7] | §aTPS: §e${worldTPS}§7/§e20`);
    player.runCommand("playsound random.orb @s");
});

//
// RTP Command
//

Command.register({
    name: "rtp",
    description: "",
    aliases: [],
}, (data) => {
    const { player } = data;
 
    showRandomTPUI(player);
});

//
// TPA Command
//

Command.register({
    name: "tpa",
    description: "",
    aliases: [],
}, (data, args) => {
    const { player } = data;

    if (!args[0]) {
        player.sendMessage(`§7[§b#§7] §cInvalid usage! Use §3!tpa §asend ${main.player} / §3!tpa §aaccept ${main.player} / §3!tpa §cdecline ${main.player} / §3!tpa §0block ${main.player} / §3!tpa §bunblock ${main.player}.`);
        return system.run(() => player.runCommand(`playsound random.break @s`));
    }

    switch (args[0].toLowerCase()) {
        case "send":
            const target = world.getPlayers().find(p => p.name === args[1]);
            if (!target) return player.sendMessage(`§7[§b#§7] §cPlayer not found.`);
            if (target.id === player.id) return player.sendMessage("§7[§b#§7] §cYou cannot send a request to yourself!");
            sendTeleportRequest(player, target);
            break;
        case "accept":
            if (args[1]) {
                const sender = world.getPlayers().find(p => p.name === args[1]);
                if (!sender) return player.sendMessage(`§7[§b#§7] §cPlayer not found.`);
                acceptTeleportRequestFrom(player, sender);
            } else {
                acceptTeleportRequest(player);
            }
            break;
        case "decline":
            declineTeleportRequest(player);
            break;
        case "block":
            if (!args[1]) return player.sendMessage("§7[§b#§7] §cSpecify a player to block.");
            const blockTarget = world.getPlayers().find(p => p.name === args[1]);
            if (!blockTarget) return player.sendMessage(`§7[§b#§7] §cPlayer not found.`);
            if (blockTarget.id === player.id) return player.sendMessage("§7[§b#§7] §cYou cannot block yourself!");
            blockPlayer(player, blockTarget);
            break;
        case "unblock":
            if (!args[1]) return player.sendMessage("§7[§b#§7] §cSpecify a player to unblock.");
            const unblockTarget = world.getPlayers().find(p => p.name === args[1]);
            if (!unblockTarget) return player.sendMessage(`§7[§b#§7] §cPlayer not found.`);
            if (unblockTarget.id === player.id) return player.sendMessage("§7[§b#§7] §cYou cannot unblock yourself!");
            unblockPlayer(player, unblockTarget);
            break;
        default:
            player.sendMessage("§7[§b#§7] §cInvalid usage! Use §3!tpa send <player> / !tpa accept [player] / !tpa decline / !tpa block <player> / !tpa unblock <player>.");
            system.run(() => player.runCommand(`playsound random.break @s`));
    }
});

//
// Ender Chest Command
//

const echest_cooldown = 2 * 60 * 60 * 1000;
const PLAYER_COOLDOWN_KEY = "echestCooldown";

Command.register({
    name: "echest",
    description: "",
    aliases: [],
}, (data) => {
    const { player } = data;
    const playerKey = `${player.id}:${PLAYER_COOLDOWN_KEY}`;

    const lastClaimTime = world.getDynamicProperty(playerKey) || 0;
    const currentTime = Date.now();

    if (lastClaimTime && currentTime - lastClaimTime < echest_cooldown) {
        const remainingTime = Math.ceil((echest_cooldown - (currentTime - lastClaimTime)) / 60000);
        const hours = Math.floor(remainingTime / 60);
        const minutes = remainingTime % 60;

        player.sendMessage(
            `§7[§b#§7] §cYou must wait §e${hours}h ${minutes}m §cto use the Ender Chest again.`
        );
        system.run(() => player.runCommand("playsound random.break @s"));
        return;
    }

    const inventory = player.getComponent("inventory")?.container;
    if (!inventory) return;

    let hasEChest = false;
    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (item && item.typeId === "minecraft:ender_chest") {
            hasEChest = true;
            break;
        }
    }

    if (hasEChest) {
        player.sendMessage("§7[§b#§7] §cYou already have an Ender Chest.");
        system.run(() => player.runCommand("playsound random.break @s"));
        return;
    }

    system.run(() => player.runCommand("give @s ender_chest 1"))
        .then(() => {
            player.sendMessage("§7[§a/§7] §aYou have received an Ender Chest!");
            system.run(() => player.runCommand("playsound random.levelup @s"));

            world.setDynamicProperty(playerKey, currentTime);
        })
        .catch((error) => {
            player.sendMessage("§7[§c-§7] §cFailed to give an Ender Chest. Please try again.");
            console.error(`Error giving ender chest: ${error.message}`);
        });
});

//
// Spawn Command
//

const SPAWN_DYNAMIC_PROPERTY = "spawnLocation";

function saveSpawnLocation(location) {
    world.setDynamicProperty(SPAWN_DYNAMIC_PROPERTY, JSON.stringify(location));
}

function loadSpawnLocation() {
    const locationData = world.getDynamicProperty(SPAWN_DYNAMIC_PROPERTY);
    return locationData ? JSON.parse(locationData) : null;
}

Command.register({
    name: "spawn",
    description: "",
    aliases: [],
}, (data) => {
    const { player } = data;
    const { id } = player;
    const spawnLocation = loadSpawnLocation();

    if (!spawnLocation) {
        player.sendMessage('§7[§c-§7] §cSpawn location has not been set by an admin.');
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }
    
    if (player.hasTag("isCombat")) {
        player.sendMessage("§7[§c!§7] §cYou cannot teleport to spawn while in combat!");
        system.run(() => player.runCommand(`playsound random.break @s`));
        return;
    }

    if (teleportingPlayers.has(id)) {
        player.sendMessage('§7[§c-§7] §cYou are already teleporting. Please wait.');
        return;
    }

    const initialPosition = { x: player.location.x, y: player.location.y, z: player.location.z };
    player.sendMessage('§7[§a/§7] §aTeleporting to spawn in §e5 seconds§a. Do not move!');

    teleportingPlayers.set(id, { initialPosition, countdown: 5, spawnLocation });

    const countdownInterval = system.runInterval(() => {
        const playerData = teleportingPlayers.get(id);
        if (!playerData || !player) {
            system.clearRun(countdownInterval);
            teleportingPlayers.delete(id);
            return;
        }

        if (player.hasTag("isCombat")) {
            player.sendMessage("§7[§c!§7] §cTeleport cancelled - you entered combat!");
            system.run(() => player.runCommand('playsound random.break @s'));
            system.clearRun(countdownInterval);
            teleportingPlayers.delete(id);
            return;
        }

        const { countdown, initialPosition, spawnLocation } = playerData;
        const currentPosition = { x: player.location.x, y: player.location.y, z: player.location.z };

        if (
            currentPosition.x !== initialPosition.x ||
            currentPosition.y !== initialPosition.y ||
            currentPosition.z !== initialPosition.z
        ) {
            player.sendMessage('§7[§c-§7] §cTeleport cancelled - you moved!');
            system.run(() => player.runCommand('playsound random.break @s'));
            teleportingPlayers.delete(id);
            system.clearRun(countdownInterval);
            return;
        }

        playerData.countdown -= 1;

        if (playerData.countdown > 0) {
            player.sendMessage(`§7[§a/§7] §aTeleporting in §e${playerData.countdown} seconds§a...`);
            system.run(() => player.runCommand('playsound random.orb @s'));
        } else {
            system.clearRun(countdownInterval);
            teleportingPlayers.delete(id);

            // Handle both old and new spawn formats
            const x = spawnLocation.location ? spawnLocation.location.x : spawnLocation.x;
            const y = spawnLocation.location ? spawnLocation.location.y : spawnLocation.y;
            const z = spawnLocation.location ? spawnLocation.location.z : spawnLocation.z;
            const dimension = spawnLocation.dimension || "minecraft:overworld";
            const dimName = dimension === "minecraft:overworld" ? "overworld" :
                            dimension === "minecraft:nether" ? "nether" : "the_end";

            system.run(() => {
                try {
                    player.runCommand(`execute in ${dimName} run tp @s ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)}`);
                    player.sendMessage('§7[§a/§7] §aYou have been teleported to spawn.');
                    player.runCommand('playsound random.levelup @s');
                    
                    world.getPlayers({ tags: ["notify"] }).forEach(admin => {
                        admin.sendMessage(`§7[§e#§7] §e${player.name} §aused §3!spawn`);
                        system.run(() => admin.runCommand(`playsound note.pling @s`));
                    });
                } catch (error) {
                    player.sendMessage('§7[§c-§7] §cError: Unable to teleport. Please try again.');
                    console.error(`Spawn teleport error: ${error.message}`);
                }
            });
        }
    }, 20);
});

Command.register({
    name: "setspawn",
    description: "",
    aliases: [],
    permission: (player) => player.hasTag(main.adminTag),
}, (data) => {
    const { player } = data;

    const location = {
        location: {
            x: Math.floor(player.location.x),
            y: Math.floor(player.location.y),
            z: Math.floor(player.location.z)
        },
        dimension: player.dimension.id,
        creator: player.name
    };

    saveSpawnLocation(location);

    player.sendMessage(`§7[§a/§7] §aSpawn set to: §e${location.location.x} ${location.location.y} ${location.location.z}`);
    system.run(() => player.runCommand(`playsound random.levelup @s`));
    
    world.getPlayers({ tags: ["notify"] }).forEach(admin => {
        admin.sendMessage(`§7[§e#§7] §e${player.name} §aused §3!setspawn`);
        system.run(() => admin.runCommand(`playsound note.pling @s`));
    });
});

Command.register({
    name: "rspawn",
    description: "",
    aliases: [],
    permission: (player) => player.hasTag(main.adminTag),
}, (data) => {
    const { player } = data;

    world.setDynamicProperty(SPAWN_DYNAMIC_PROPERTY, null);
    player.sendMessage('§7[§a/§7] §aSpawn location removed.');
    system.run(() => player.runCommand(`playsound random.break @s`));
    
    world.getPlayers({ tags: ["notify"] }).forEach(admin => {
        admin.sendMessage(`§7[§e#§7] §e${player.name} §aused §3!rspawn`);
        system.run(() => admin.runCommand(`playsound note.pling @s`));
    });
});

//
// Compass Command 
//

Command.register({
    name: "compass",
    description: "",
    aliases: [],
}, (data) => {
    const player = data.player;

    const inventory = player.getComponent("inventory")?.container;
    if (!inventory) return;

    let hasCompass = false;
    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (item && item.typeId === "bluemods:itemui") {
            hasCompass = true;
            break;
        }
    }

    if (!hasCompass) {
        system.run(() => player.runCommand('give @s bluemods:itemui'));
        player.sendMessage("§7[§b#§7] §aYou received a compass!");
    } else {
        player.sendMessage("§7[§b#§7] §cYou already have a compass in your inventory.");
        system.run(() => player.runCommand('playsound random.break @s'));
    }

    system.run(() => player.runCommand('playsound note.pling @s'));
});

//
// Back Command
//

const deathLocations = new Map();

world.afterEvents.entityDie.subscribe((event) => {
    const { deadEntity } = event;

    if (deadEntity && deadEntity.typeId === "minecraft:player") {
        const playerName = deadEntity.name;
        const { x, y, z } = deadEntity.location;
        const dimensionId = deadEntity.dimension.id.replace("minecraft:", "");

        deathLocations.set(playerName, { x, y, z, dimensionId });
    }
});

Command.register({
    name: "back",
    description: "",
    aliases: [],
}, (data) => {
    const { player } = data;

    const playerName = player.name;

    if (!deathLocations.has(playerName)) {
        player.sendMessage("§7[§b#§7] §cYou haven't died recently or your death location is unavailable.");
        return;
    }

    const { x, y, z, dimensionId } = deathLocations.get(playerName);
    const currentDimension = player.dimension.id.replace("minecraft:", "");

    if (x === player.location.x && y === player.location.y && z === player.location.z && dimensionId === currentDimension) {
        player.sendMessage("§7[§b#§7] §cYou are already at your death location.");
        return;
    }

    let executeCommand = `execute in ${dimensionId} run tp @s ${x} ${y} ${z}`;

    system.run(() => player.runCommand(executeCommand)).then(() => {
        player.sendMessage("§7[§b#§7] §aYou have been teleported back to your death location.");
        deathLocations.delete(playerName);
    }).catch(() => {
        player.sendMessage("§7[§b#§7] §cTeleportation failed. Invalid dimension.");
    });
});

//
// Warp Command
//

import { teleportWarp, showWarpsUI, setWarp, removeWarp, WARP_DYNAMIC_PROPERTY } from "../main/selection/playerWarps.js";

Command.register({
    name: "warp",
    description: "",
    aliases: [],
}, (data, args) => {
    const { player } = data;

    const action = args[0]?.toLowerCase();
    const warpName = args[1];

    if (!action) {
        player.sendMessage(`§7[§b#§7] §cInvalid action! §aUse§7: §3!warp §7<§atp§7/§elist§7/§aset§7/§cremove§7> §7<§ewarpName§7>`);
        if (player.hasTag(main.adminTag)) {
            player.sendMessage(`§7[§b#§7] §aAdmin§7: §3!warp §aset §7<§ewarpName§7> §7/ §3!warp §cremove §7<§ewarpName§7>`);
        }
        return;
    }

    switch (action) {
        case "tp":
            if (!warpName) {
                player.sendMessage(`§7[§c-§7] §cPlease specify a warp name. §3!warp tp <warpName>`);
                return;
            }
            teleportWarp(player, warpName);
            break;
        case "list":
            const warpDataJson = world.getDynamicProperty(WARP_DYNAMIC_PROPERTY);
            const warps = warpDataJson ? JSON.parse(warpDataJson) : {};
            const warpList = Object.keys(warps);
            if (warpList.length === 0) {
                player.sendMessage('§7[§c-§7] §cNo warps are set.');
            } else {
                const warpInfo = warpList.map(name => {
                    const creator = warps[name]?.creator || "Unknown";
                    return `§e${name} §7(by ${creator})`;
                });
                player.sendMessage(`§7[§a/§7] §aAvailable warps:\n${warpInfo.join('\n')}`);
            }
            break;
        case "set":
            if (!player.hasTag(main.adminTag)) {
                player.sendMessage(`§7[§c-§7] §cYou don't have permission to set warps.`);
                return;
            }
            if (!warpName) {
                player.sendMessage(`§7[§c-§7] §cPlease specify a warp name. §3!warp set <warpName>`);
                return;
            }
            setWarp(player, warpName);
            break;
        case "remove":
            if (!player.hasTag(main.adminTag)) {
                player.sendMessage(`§7[§c-§7] §cYou don't have permission to remove warps.`);
                return;
            }
            if (!warpName) {
                player.sendMessage(`§7[§c-§7] §cPlease specify a warp name. §3!warp remove <warpName>`);
                return;
            }
            removeWarp(player, warpName);
            break;
        default:
            player.sendMessage(`§7[§b#§7] §cUnknown action. Use §3!warp <tp/list/set/remove>`);
    }
});

//
// Coordinates Command
//

const coordToggled = new Set();
const coordSettings = new Map();
let cachedTPS = 20;
let tickCount = 0;
let lastTime = Date.now();

function getPlayerSettings(playerId) {
    if (!coordSettings.has(playerId)) {
        coordSettings.set(playerId, { showTPS: true, showCoords: true, showDimension: true });
    }
    return coordSettings.get(playerId);
}

system.runInterval(() => {
    tickCount++;
    const now = Date.now();
    const elapsed = (now - lastTime) / 1000;
    if (elapsed >= 1) {
        cachedTPS = tickCount / elapsed;
        tickCount = 0;
        lastTime = now;
    }

    if (tickCount % 5 === 0) {
        for (const player of world.getAllPlayers()) {
            if (coordToggled.has(player.id)) {
                const settings = getPlayerSettings(player.id);
                const { x, y, z } = player.location;
                const dimension = player.dimension.id.replace("minecraft:", "");
                
                let display = "";
                if (settings.showTPS) display += `§aTPS: §e${cachedTPS.toFixed(1)}`;
                if (settings.showCoords) {
                    if (display) display += " §7|";
                    display += ` §aX: §e${Math.floor(x)} §aY: §e${Math.floor(y)} §aZ: §e${Math.floor(z)}`;
                }
                if (settings.showDimension) {
                    if (display) display += " §7|";
                    display += ` §b${dimension}`;
                }
                
                player.onScreenDisplay.setActionBar(display || "§cAll modules disabled");
            }
        }
    }
}, 1);

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    coordToggled.delete(playerId);
    coordSettings.delete(playerId);
});

Command.register({
    name: "coordtoggle",
    description: "",
    aliases: [],
}, (data, args) => {
    const { player } = data;
    const action = args[0]?.toLowerCase();
    const module = args[1]?.toLowerCase();

    if (action === "list") {
        const settings = getPlayerSettings(player.id);
        player.sendMessage([
            `§7[§b#§7] §aYour Coordinate Modules:`,
            `§7TPS: ${settings.showTPS ? "§aEnabled" : "§cDisabled"}`,
            `§7Coordinates: ${settings.showCoords ? "§aEnabled" : "§cDisabled"}`,
            `§7Dimension: ${settings.showDimension ? "§aEnabled" : "§cDisabled"}`
        ].join("\n"));
        return;
    }

    if (action === "enable" || action === "disable") {
        if (!module || !["tps", "coordinates", "dimensions"].includes(module)) {
            player.sendMessage(`§7[§c-§7] §cInvalid module! Use: §3!coordtoggle ${action} §7<§atps§7/§ecoordinates§7/§bdimensions§7> §7or §3!coordtoggle §alist`);
            return;
        }

        const settings = getPlayerSettings(player.id);
        const enabled = action === "enable";
        const moduleName = module === "coordinates" ? "Coords" : module.charAt(0).toUpperCase() + module.slice(1);

        switch (module) {
            case "tps": settings.showTPS = enabled; break;
            case "coordinates": settings.showCoords = enabled; break;
            case "dimensions": settings.showDimension = enabled; break;
        }

        if (enabled) {
            coordToggled.add(player.id);
        } else if (!settings.showTPS && !settings.showCoords && !settings.showDimension) {
            coordToggled.delete(player.id);
        }

        player.sendMessage(`§7[${enabled ? "§a+§7" : "§c-§7"}] §7${moduleName} §f${enabled ? "§aEnabled" : "§cDisabled"}.`);
        system.run(() => player.runCommand('playsound note.bell @s'));
        return;
    }

    if (!action) {
        if (coordToggled.has(player.id)) {
            coordToggled.delete(player.id);
            player.sendMessage("§7[§c-§7] §fPersonal Coordinates §cDisabled.");
        } else {
            coordToggled.add(player.id);
            player.sendMessage("§7[§a+§7] §fPersonal Coordinates §aEnabled.");
        }
        system.run(() => player.runCommand('playsound note.bell @s'));
    } else {
        player.sendMessage(`§7[§c-§7] §cInvalid action! Use: §3!coordtoggle ${main.enabledisable} §7<§atps§7/§ecoordinates§7/§bdimensions§7> §7or §3!coordtoggle §alist`);
    }
});

//
//  Auction House Command
//

import { showEconomy } from "../main/selection/playerEconomy.js";

Command.register({
    name: "auctionhouse",
    description: "",
    aliases: ["ah"],
}, (data, args) => {
    const { player } = data;
    player.sendMessage("§7[!] §aOpening Auction House...");

    let attempts = 0;
    const maxAttempts = 10;
    const interval = system.runInterval(() => {
        if (attempts >= maxAttempts) {
            system.clearRun(interval);
            player.sendMessage("§7[§c-§7] §cCould not open Auction House. Please close any open windows and try again.");
            return;
        }
        try {
            showEconomy(player);
            system.clearRun(interval);
        } catch (e) {
            attempts++;
        }
    }, 20);
});