import { world, system, ItemStack, EntityAttributeComponent, EntityHealthComponent, EntityScaleComponent } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { isLored, isDanger, isOperator, isSpawnEgg, isUnknown, playerProjectiles, isBundles, isContainers } from "../../items.js";
import { showModerationUI } from "../playerModeration.js";
import { customFormUICodes } from "../../handler/customFormUICodes.js";
import main from "../../config.js";

//░███░░██░░██░░█░████░██░░██░░████░░████░░░███░
//░█░░█░█░░░░█░░█░█░░░░██░░██░█░░░█░░█░░░█░█░░█░
//░███░░█░░░░█░░█░███░░██░░██░█░░░░█░█░░░█░██░░░
//░█░░█░█░░░░█░░█░█░░░░█░██░█░█░░░░█░█░░░█░░░█░░
//░█░░█░█░░█░█░░█░█░░█░█░██░█░█░░░█░░█░░░█░█░░█░
//░███░░████░███░░████░█░█░░█░░███░░░████░░███░░
// https://dsc.gg/bluemods

const adminTag = "admin";
const MODULE_STATES_KEY = "Modules";
const max_nbt_size = 1024;

const defaultModules = {
    receiveCompassOnJoin: false,
    removeDupeBundles: true,
    removeDupeCrafter: true,
    removeDupeStackedInventory: true,
    antiSpamClicks: false,
    inCombatLogging: false,
    enchantmentCheck: false,
    loredItemCheck: true,
    dangerItemCheck: true,
    operatorItemCheck: true,
    eggItemCheck: true,
    unknownItemCheck: true,
    nameSpoofCheck: true,
    nbtItemCheck: true,
    isAgentMob: true,
    isCommandBlockMinecart: true,
    isNPCMob: false,
    isCreativeMode: false
};

system.run(() => {
    try {
        const storedStates = world.getDynamicProperty(MODULE_STATES_KEY);
        main.Modules = storedStates ? { ...defaultModules, ...JSON.parse(storedStates) } : defaultModules;
        if (!storedStates) world.setDynamicProperty(MODULE_STATES_KEY, JSON.stringify(defaultModules));
    } catch (error) {
        console.error(`Error loading module states: ${error.message}`);
        main.Modules = defaultModules;
    }
});

function saveModules() {
    try {
        world.setDynamicProperty(MODULE_STATES_KEY, JSON.stringify(main.Modules));
    } catch (error) {
        console.error(`Error saving module states: ${error.message}`);
    }
}

function isModuleEnabled(module) {
    return main.Modules[module];
}

function hasLore(item) {
    return Boolean(item?.getLore()?.length);
}

function itemCheck(player, itemList, moduleName) {
    if (!isModuleEnabled(moduleName)) return;

    const inventory = player.getComponent("inventory").container;
    if (!inventory || inventory.size === inventory.emptySlotsCount) return;

    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (!item) continue;

        if (itemList.includes(item.typeId)) {
            if (itemList === isLored) {
                if (hasLore(item)) {
                    inventory.setItem(i, null);
                    addLog(player.name, "Lored Item", item.typeId.replace("minecraft:", ""));
                    player.sendMessage(`§7[§b#§7] §cYou are not allowed to use lored container items.`);
                    system.run(() => player.runCommand(`playsound random.break @s`));

                    world.getPlayers({ tags: ["notify"] }).forEach(admin => {
                        admin.sendMessage(`§7[§d#§7] §e${player.name} §ais trying to use a lored container: "§e${item.typeId.replace('minecraft:', '').replace(/_/g, ' ')}§a".`);
                        system.run(() => admin.runCommand(`playsound random.break @s`));
                    });
                }
            } else {
                if (!isLored.includes(item.typeId) || hasLore(item)) {
                    inventory.setItem(i, null);
                    addLog(player.name, "Illegal Item", item.typeId.replace("minecraft:", ""));
                    player.sendMessage("§7[§b#§7] §cYou are not allowed to use this item.");
                    system.run(() => player.runCommand(`playsound random.break @s`));

                    world.getPlayers({ tags: ["notify"] }).forEach(admin => {
                        const itemName = item.typeId.replace('minecraft:', '').replace(/_/g, ' ');
                        admin.sendMessage(`§7[§d#§7] §e${player.name} §ais trying to use illegal item: §e${itemName}`);
                        system.run(() => admin.runCommand(`playsound random.break @s`));
                    });
                }
            }
        }
    }
}

function checkItemNBT(player) {
    if (!isModuleEnabled("nbtItemCheck")) return;
    if (player.hasTag(adminTag)) return;

    const inventory = player.getComponent("inventory").container;
    if (!inventory) return;

    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (!item) continue;

        const itemData = JSON.stringify(item);
        if (itemData.length > max_nbt_size) {
            inventory.setItem(i, null);
            player.sendMessage("§7[§b#§7] §cIllegal NBT detected, item removed.");
            addLog(player.name, "NBT Violation", `Item data size: ${itemData.length}`);

            world.getPlayers({ tags: ["notify"] }).forEach(admin => {
                admin.sendMessage(`§7[§d#§7] §e${player.name} §atried to use an illegal NBT item.`);
                system.run(() => admin.runCommand(`playsound random.break @s`));
            });
        }
    }
}

//
// NameSpoof Checks
//

const validNameRegex = /^[\x21-\x26\x28-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E\xA0-\xBF\x20\x27\x30-\x39\x41-\x5A\x61-\x7A\xC0-\xF6\xF8-\xFF\u0100-\u017F\u1100-\u1112\u1161-\u1175\u11A8-\u11C2\uAC00-\uD7A3\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF\u0400-\u045F\u0985-\u09B9\u0E01-\u0E3A\u0E40-\u0E4E\u0E01-\u0E30\u0E32-\u0E33\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0390-\u03CE\u0900-\u094F\u0966-\u096F\u0671-\u06D3\u06F0-\u06F9\u0904-\u0939\u0900-\u0903\u093A-\u094F\u0620-\u064A\u0660-\u0669\u05D0-\u05EA]{1,20}$/u;

const checkForNameSpoof = (player) => {
    if (!isModuleEnabled("nameSpoofCheck")) return;
    
    const playerName = player.name.trim();
    return !validNameRegex.test(playerName);
};

world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;

    if (checkForNameSpoof(player)) {
        addLog(player.name, "Name Spoof", `Invalid username detected`);
        system.run(() => player.runCommand('kick @s §cInvalid or spoofed name detected. Check your username for validity.'));

        world.getPlayers({ tags: ["notify"] }).forEach(admin => {
            admin.sendMessage(`§7[§d#§7] §e${player.name} §ahas been kicked out for using an invalid username.`);
            system.run(() => admin.runCommand(`playsound random.break @s`));
        });
    }
});

//
// GameMode Checks
//

const lastValidGamemodes = new Map();

function checkGameMode(player) {
    if (!isModuleEnabled("isCreativeMode")) return;
        try {
            const currentMode = player.getGameMode();
            const tags = player.getTags();
            const isAdmin = tags.includes("admin") || tags.includes("trusted");
    
            const prevMode = lastValidGamemodes.get(player.name);
    
            if (currentMode === "creative" && !isAdmin) {
                if (prevMode && prevMode !== "creative") {
                    player.sendMessage("§cYou are not allowed to use Creative Mode. Reverting back.");
                    player.runCommand(`gamemode ${prevMode}`);
                    addLog(player.name, "Creative Mode", `Trying to use Creative Mode while not being operator`);
                } else {
                    player.runCommand("gamemode survival");
                }
            } else {
                lastValidGamemodes.set(player.name, currentMode);
            }
        } catch (err) {
        console.warn(`[BlueMods-Gamemode] Error checking ${player.name}:`, err);
    }
}

//
// Anti InCombat Log
//

export const CombatDatabase = {};

world.afterEvents.entityHurt.subscribe((event) => {
    if (!isModuleEnabled("inCombatLogging")) return;
    
    if (event.damageSource.cause === "projectile") {
        if (!playerProjectiles.includes(event.damageSource.damagingEntity?.typeId)) return;
    } else if (event.damageSource.cause !== "entityAttack") {
        return;
    }
    
    const victim = event.hurtEntity;
    const attacker = event.damageSource.damagingEntity;
    
    if (attacker?.typeId === "minecraft:player") {
        CombatDatabase[attacker.id] = { 
            timer: setTimer(main.combatTimer, 'seconds'),
            victim: victim.id
        };
        attacker.addTag('isCombat');
    }
    
    if (victim?.typeId === "minecraft:player") {
        CombatDatabase[victim.id] = { 
            timer: setTimer(main.combatTimer, 'seconds'),
            attacker: attacker.id
        };
        victim.addTag('isCombat');
    }
}, { entityTypes: ["minecraft:player"] });

system.runInterval(() => {
    world.getPlayers({ tag: 'isCombat' }).forEach((player) => {
        if (!CombatDatabase[player.id]) {
            player.removeTag('isCombat');
            return;
        }

        const timeLeft = getTime(CombatDatabase[player.id].timer).seconds;
        player.onScreenDisplay.setActionBar(`§cCombat Logged: §7${Math.max(0, timeLeft)}s`);
        
        if (hasTimerReachedEnd(CombatDatabase[player.id].timer.targetDate)) {
            player.sendMessage('§7[§a+§7] §aYou left in combat');
            player.removeTag('isCombat');
            delete CombatDatabase[player.id];
            return;
        }

        const playerInv = player.getComponent('inventory').container;
        CombatDatabase[player.id] = {
            ...CombatDatabase[player.id],
            location: player.location,
            dimension: player.dimension.id,
            items: [
                ...Array.from({ length: playerInv.size }, (_, i) => playerInv.getItem(i)).filter(Boolean),
                ...["Head", "Chest", "Legs", "Feet"]
                    .map(slot => player.getComponent("equippable")?.getEquipment(slot))
                    .filter(Boolean)
            ]
        };
    });
}, 20);

world.afterEvents.playerLeave.subscribe(({ playerId, playerName }) => {
    const combatData = CombatDatabase[playerId];
    if (!combatData || combatData.clear) return;
    
    combatData.items?.forEach(item => {
        world.getDimension(combatData.dimension)
            .spawnItem(item, combatData.location);
    });
    
    CombatDatabase[playerId] = { ...combatData, clear: true };
    
    const opponentId = combatData.attacker || combatData.victim;
    if (opponentId && CombatDatabase[opponentId]) {
        const opponent = world.getPlayers().find(p => p.id === opponentId);
        
        if (opponent) {
            opponent.removeTag('isCombat');
            opponent.sendMessage(`§7[§c!§7] §e${playerName} §clogged during combat!`);
            opponent.sendMessage('§7[§a+§7] §aCombat ended');
        }
        delete CombatDatabase[opponentId];
    }
    
    console.warn(`[CombatLog] ${playerName} logged during combat`);
});

world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    if (!event.initialSpawn || !CombatDatabase[player.id]?.clear) return;
    
    delete CombatDatabase[player.id];
    
    system.run(() => {
        player.runCommand('clear @s');
        player.runCommand(`kill @s`);
    });
    
    player.sendMessage('§7[§c!§7] §cYour inventory was cleared for combat logging!');
    addLog(player.name, "Combat Log", `Left the server while incombat`);
    
    world.getPlayers({ tags: ["notify"] }).forEach(admin => {
        admin.sendMessage(`§8[§4ALERT§8] §c${player.name} §7returned after combat logging`);
    });
});

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (deadEntity.typeId !== "minecraft:player") return;
    
    const attackerId = CombatDatabase[deadEntity.id]?.attacker;
    
    if (CombatDatabase[deadEntity.id]) {
        const attacker = world.getPlayers().find(p => p.id === attackerId);
        
        deadEntity.removeTag('isCombat');
        deadEntity.sendMessage('§7[§a+§7] §aCombat ended');
        delete CombatDatabase[deadEntity.id];
        
        attacker.removeTag('isCombat');
        attacker.sendMessage('§7[§a+§7] §aCombat ended (target died)');
        delete CombatDatabase[attackerId];
    }
});

export function setTimer(value, unit) {
    const targetDate = new Date();
    switch (unit) {
        case 'hours': targetDate.setHours(targetDate.getHours() + value); break;
        case 'days': targetDate.setDate(targetDate.getDate() + value); break;
        case 'minutes': targetDate.setMinutes(targetDate.getMinutes() + value); break;
        case 'seconds': targetDate.setSeconds(targetDate.getSeconds() + value); break;
    }
    return { targetDate };
}

export function hasTimerReachedEnd(targetDate) {
    return Date.now() >= new Date(targetDate).getTime();
}

export function formatTime(milliseconds) {
    return {
        days: Math.floor(milliseconds / 86400000),
        hours: Math.floor(milliseconds / 3600000) % 24,
        minutes: Math.floor(milliseconds / 60000) % 60,
        seconds: Math.floor(milliseconds / 1000) % 60
    };
}

export function getTime(timerInfo) {
    return formatTime(new Date(timerInfo.targetDate) - Date.now());
}

//
// Received Compass Upon Joining
//

world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    if (!isModuleEnabled("receiveCompassOnJoin")) return;
    
    if (player.hasTag("new-player")) return;
    system.run(() => {
        player.runCommand("give @s bluemods:itemui");
        player.runCommand("tag @s add new-player");
    });
    player.sendMessage("§7[§b#§7] §aYou've received a Menu Compass for being a New Player");
});

//
// Anti Enchantment
//

function enchantCheck() {
    if (!isModuleEnabled("enchantmentCheck")) return;
    
    try {
        for (const player of world.getPlayers()) {
            if (player.hasTag(adminTag)) continue;

            const inventory = player.getComponent("inventory")?.container;
            if (!inventory || inventory.size === inventory.emptySlotsCount) continue;

            for (let i = 0; i < inventory.size; i++) {
                const item = inventory.getItem(i);
                if (!item || !item.typeId) continue;

                const enchantmentComponent = item.getComponent("enchantable");
                if (!enchantmentComponent) continue;

                const enchantments = enchantmentComponent.getEnchantments();
                let modified = false;

                const newEnchantments = [];
                for (const enchant of enchantments) {
                    if (enchant.level > enchant.type.maxLevel) {
                        modified = true;
                    } else {
                        newEnchantments.push(enchant);
                    }
                }
                
                if (modified) {
                    addLog(player.name, "Illegal Enchantment", item.typeId.replace("minecraft:", ""));
                    
                    enchantmentComponent.removeAllEnchantments();
                    for (const enchant of newEnchantments) {
                        enchantmentComponent.addEnchantment(enchant);
                    }
                    inventory.setItem(i, item);

                    player.sendMessage(`§7[§b#§7] §cIllegal enchantments removed§7: §e${item.typeId.replace("minecraft:", "")}`);

                    world.getPlayers({ tags: ["notify"] }).forEach(admin => {
                        admin.sendMessage(`§7[§d#§7] §e${player.name} §ais trying to get illegal enchantments§7: §e${item.typeId.replace("minecraft:", "")}`);
                        admin.runCommand(`playsound random.break @s`);
                    });
                }
            }
        }
    } catch (error) {
        console.error("Error in enchantCheck:", error);
    }

    system.run(enchantCheck);
}

system.run(enchantCheck);

let itemCheckInterval;
let entityCheckInterval;


//
//  Bundle checks
//

function checkCrafterForBundleRecipe(player) {
    if (!isModuleEnabled("removeDupeCrafter")) return;

    const { location, dimension } = player;

    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                try {
                    const checkY = Math.floor(location.y) + y;
                    if (checkY < -64 || checkY > 320) continue;
                    
                    const blockX = Math.floor(location.x) + x;
                    const blockZ = Math.floor(location.z) + z;
                    
                    const block = dimension.getBlock({
                        x: blockX,
                        y: checkY,
                        z: blockZ
                    });

                    if (block && block.typeId === "minecraft:crafter") {
                        const container = block.getComponent("minecraft:inventory")?.container;
                        if (!container) continue;

                        let itemsDeleted = false;

                        for (let i = 0; i < container.size; i++) {
                            const item = container.getItem(i);
                            
                            if (item && (item.typeId === "minecraft:string" || item.typeId === "minecraft:leather")) {
                                container.setItem(i, undefined);
                                itemsDeleted = true;
                            }
                        }
                        
                        if (itemsDeleted) {
                            addLog(player.name, "Dupe Bundle Crafter", "Tried to put String/Leather in a Crafter");
                            system.run(() => player.runCommand(`playsound random.break @s`));

                            world.getPlayers({ tags: ["notify"] }).forEach(admin => {
                                admin.sendMessage(`§7[§d#§7] §e${player.name} §atried to put Bundle ingredients in a Crafter.`);
                                system.run(() => admin.runCommand(`playsound random.break @s`));
                            });
                        }
                    }
                } catch (error) {
                    continue;
                }
            }
        }
    }
}

function removeFromContainer(container, itemType) {
    let removed = false;

    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item?.typeId === itemType) {
            container.setItem(i, undefined);
            removed = true;
        }
    }

    return removed;
}

function checkPlayerAndContainers(player) {
    if (!isModuleEnabled("removeDupeBundles")) return;
    
    const playerInv = player.getComponent("inventory")?.container;
    if (!playerInv) return;

    let hasBundles = false;
    for (let i = 0; i < playerInv.size; i++) {
        const item = playerInv.getItem(i);
        if (item && isBundles.includes(item.typeId)) {
            hasBundles = true;
            break;
        }
    }
    if (!hasBundles) return;
    
    const { location, dimension } = player;

    for (let x = -6; x <= 6; x++) {
        for (let y = -3; y <= 3; y++) {
            for (let z = -6; z <= 6; z++) {
                try {
                    const checkY = Math.floor(location.y) + y;
                    if (checkY < -64 || checkY > 320) continue;
                    
                    const blockX = Math.floor(location.x) + x;
                    const blockZ = Math.floor(location.z) + z;
                    
                    const block = dimension.getBlock({
                        x: blockX,
                        y: checkY,
                        z: blockZ
                    });

                    if (block && isContainers.includes(block.typeId)) {
                        const container = block.getComponent("minecraft:inventory")?.container;
                        if (container) {
                            for (const itemType of isBundles) {
                                const removed = removeFromContainer(container, itemType);
                                if (removed) {
                                    let nearestPlayer = "Unknown";
                                    let nearestDistance = Infinity;
                                    
                                    for (const p of world.getAllPlayers()) {
                                        const dist = Math.sqrt(
                                            Math.pow(p.location.x - blockX, 2) +
                                            Math.pow(p.location.y - checkY, 2) +
                                            Math.pow(p.location.z - blockZ, 2)
                                        );
                                        if (dist < nearestDistance) {
                                            nearestDistance = dist;
                                            nearestPlayer = p.name;
                                        }
                                    }
                                    
                                    addLog(nearestPlayer, "Dupe Bundle", `${itemType.replace("minecraft:", "")} at §a${blockX} ${checkY} ${blockZ}§r`);
                                }
                            }
                        }
                    }
                } catch (error) {
                    continue;
                }
            }
        }
    }
}

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        checkPlayerAndContainers(player);
        checkCrafterForBundleRecipe(player);
    }
}, 1);

//
// Inventory Consolidator (Merges ALL items into stacks of 64 on Join)
//

world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    
    consolidateInventory(player); 
});

function consolidateInventory(player) {
    if (!isModuleEnabled("removeDupeStackedInventory")) return;
    
    const inventory = player.getComponent("inventory").container;
    if (!inventory) return;

    const totalCounts = new Map();

    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (!item) continue;

        const id = item.typeId;
        const currentCount = totalCounts.get(id) || 0;
        totalCounts.set(id, currentCount + item.amount);
        
        inventory.setItem(i, undefined);
    }

    let slotIndex = 0;
    for (const [id, total] of totalCounts.entries()) {
        let remaining = total;

        while (remaining > 0 && slotIndex < inventory.size) {
            const stackSize = Math.min(remaining, 64);
            const newStack = new ItemStack(id, stackSize);
            
            inventory.setItem(slotIndex, newStack);
            
            remaining -= stackSize;
            slotIndex++;
        }

        if (remaining > 0 && slotIndex >= inventory.size) {
            player.dimension.spawnItem(new ItemStack(id, remaining), player.location);
            // player.sendMessage(`§7[§b#§7] §eYour inventory was full! §a${remaining}x ${id.replace("minecraft:", "")} dropped at your feet.`);
        }
    }
}

// 
// Checks the Item
//

function startItemChecks() {
    if (itemCheckInterval) system.clearRun(itemCheckInterval);

    itemCheckInterval = system.runInterval(() => {
        if (!Object.values(main.Modules).some(state => state)) {
            system.clearRun(itemCheckInterval);
            return;
        }

        world.getPlayers().forEach(player => {
            if (player.hasTag(adminTag)) return;

            if (isModuleEnabled("loredItemCheck")) itemCheck(player, isLored, "loredItemCheck");
            if (isModuleEnabled("dangerItemCheck")) itemCheck(player, isDanger, "dangerItemCheck");
            if (isModuleEnabled("operatorItemCheck")) itemCheck(player, isOperator, "operatorItemCheck");
            if (isModuleEnabled("eggItemCheck")) itemCheck(player, isSpawnEgg, "eggItemCheck");
            if (isModuleEnabled("unknownItemCheck")) itemCheck(player, isUnknown, "unknownItemCheck");
            if (isModuleEnabled("nbtItemCheck")) checkItemNBT(player);
            if (isModuleEnabled("isCreativeMode")) checkGameMode(player);
        });
    }, 5);
}

function startEntityChecks() {
    if (entityCheckInterval) system.clearRun(entityCheckInterval);

    entityCheckInterval = system.runInterval(() => {
        if (!isModuleEnabled("isAgentMob") && !isModuleEnabled("isCommandBlockMinecart")) {
            system.clearRun(entityCheckInterval);
            return;
        }

        if (isModuleEnabled("isAgentMob")) {
            world.getDimension("overworld").getEntities().forEach(entity => {
                if (entity.typeId === "minecraft:agent") entity.remove();
            });
        }

        if (isModuleEnabled("isCommandBlockMinecart")) {
            world.getDimension("overworld").getEntities().forEach(entity => {
                if (entity.typeId === "minecraft:command_block_minecart") entity.remove();
            });
        }

        if (isModuleEnabled("isNPCMob")) {
            world.getDimension("overworld").getEntities().forEach(entity => {
                if (entity.typeId === "minecraft:npc") entity.remove();
            });
        }
    }, 1);
}

export function ModulesPanel(player) {
    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aModule States")
        .body("§cWarning: Disabling this module may put the server at risk!\n§cOnly turn it off if you fully understand the consequences.");

    Object.entries(main.Modules).forEach(([module, isEnabled]) => {
        const statusText = isEnabled ? "§aEnabled" : "§cDisabled";
        const statusIcon = isEnabled ? "textures/ui/realms_green_check.png" : "textures/ui/redX1.png";
        form.button(customFormUICodes.action.buttons.positions.main_only + `§e${module}\n§7[ ${statusText} §7]`, statusIcon);
    });

    form.button(customFormUICodes.action.buttons.positions.title_bar_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled) return;

        if (response.selection < Object.keys(main.Modules).length) {
            const selectedModule = Object.keys(main.Modules)[response.selection];
            main.Modules[selectedModule] = !main.Modules[selectedModule];
            saveModules();

            player.sendMessage(`§7[§b#§7] §aToggled §e${selectedModule} §7to §b${main.Modules[selectedModule] ? "Enabled" : "Disabled"}§7.`);
            system.run(() => player.runCommand("playsound note.bell @s"));

            if (selectedModule.includes("ItemCheck")) startItemChecks();
            if (selectedModule.includes("Mob") || selectedModule.includes("Minecart")) startEntityChecks();
        }
        else {
            showModerationUI(player);
            return;
        }

        ModulesPanel(player);
    }).catch((error) => {
        console.error("Failed to show module states panel:", error);
    });
}

//
// Logging System
//

const LOGS_DYNAMIC_PROPERTY = "bluemods:player_logs";
const MAX_LOGS = 30;

export function addLog(playerName, action, details = "") {
    try {
        const logsJson = world.getDynamicProperty(LOGS_DYNAMIC_PROPERTY);
        const logs = logsJson ? JSON.parse(logsJson) : [];
        
        const logEntry = {
            player: playerName,
            action: action,
            details: details,
            timestamp: Date.now(),
            date: new Date().toLocaleString()
        };
        
        logs.unshift(logEntry);
        
        // Keep only the latest logs
        if (logs.length > MAX_LOGS) {
            logs.length = MAX_LOGS;
        }
        
        world.setDynamicProperty(LOGS_DYNAMIC_PROPERTY, JSON.stringify(logs));
    } catch (error) {
        console.error("Failed to save log:", error);
    }
}

export function getLogs() {
    try {
        const logsJson = world.getDynamicProperty(LOGS_DYNAMIC_PROPERTY);
        return logsJson ? JSON.parse(logsJson) : [];
    } catch {
        return [];
    }
}

export function clearLogs(player) {
    if (!player.hasTag(adminTag)) {
        player.sendMessage("§7[§c-§7] §cYou don't have permission to clear logs!");
        return;
    }
    
    world.setDynamicProperty(LOGS_DYNAMIC_PROPERTY, JSON.stringify([]));
    player.sendMessage("§7[§a+§7] §aAll player logs have been cleared.");
}


startItemChecks();
startEntityChecks();
