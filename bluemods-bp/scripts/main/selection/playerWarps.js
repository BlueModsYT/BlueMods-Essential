import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { showCompassUI } from "../playerCompass.js";
import { customFormUICodes } from "../../handler/customFormUICodes.js";
import main from "../../config.js";

//░███░░██░░██░░█░████░██░░██░░████░░████░░░███░
//░█░░█░█░░░░█░░█░█░░░░██░░██░█░░░█░░█░░░█░█░░█░
//░███░░█░░░░█░░█░███░░██░░██░█░░░░█░█░░░█░██░░░
//░█░░█░█░░░░█░░█░█░░░░█░██░█░█░░░░█░█░░░█░░░█░░
//░█░░█░█░░█░█░░█░█░░█░█░██░█░█░░░█░░█░░░█░█░░█░
//░███░░████░███░░████░█░█░░█░░███░░░████░░███░░
// https://dsc.gg/bluemods

const teleportingPlayers = new Map();
export const WARP_DYNAMIC_PROPERTY = "playerWarps";
const WARP_LIMIT = 5;

export function showWarpsUI(player) {    
    const warpDataJson = world.getDynamicProperty(WARP_DYNAMIC_PROPERTY);
    const warps = warpDataJson ? JSON.parse(warpDataJson) : {};
    const isAdmin = player.hasTag(main.adminTag);

    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aWarps")
        .body("Available Warps:");

    for (const warpName in warps) {
        const creator = warps[warpName].creator || "Admin";
        const buttonText = isAdmin 
            ? `§a${warpName}\n§7(by ${creator})`
            : `§a${warpName}`;
        form.button(customFormUICodes.action.buttons.positions.main_only + buttonText, "textures/items/compass_item");
    }

    if (isAdmin) {
        form.button(customFormUICodes.action.buttons.positions.main_only + "§eSet New Warp", "textures/ui/plus");
        form.button(customFormUICodes.action.buttons.positions.main_only + "§cRemove Warp", "textures/ui/minus");
    }

    form.button(customFormUICodes.action.buttons.positions.title_bar_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled) return;

        const selectedIndex = response.selection;
        const warpCount = Object.keys(warps).length;
        const adminButtonCount = isAdmin ? 2 : 0;
        const totalButtons = warpCount + adminButtonCount;

        if (selectedIndex < warpCount) {
            const warpName = Object.keys(warps)[selectedIndex];
            teleportWarp(player, warpName);
        }
        else if (isAdmin && selectedIndex < totalButtons) {
            if (selectedIndex === warpCount) {
                showSetWarpForm(player);
            } else if (selectedIndex === warpCount + 1) {
                showRemoveWarpForm(player);
            }
        }
        else if (selectedIndex === totalButtons) {
            showCompassUI(player);
        }
    }).catch((error) => {
        console.error("Failed to show warp form:", error);
        player.sendMessage("§7[§c-§7] §cFailed to open warp menu");
    });
}

export function teleportWarp(player, warpName) {
    if (player.hasTag("isCombat")) {
        player.sendMessage("§7[§c!§7] §cYou cannot use warps while in combat!");
        system.run(() => player.runCommand(`playsound random.break @s`));
        return;
    }
    
    if (!warpName) {
        player.sendMessage('§7[§c-§7] §cPlease specify the warp name you want to teleport to.');
        return system.run(() => player.runCommand(`playsound random.break @s`));
    }

    const warpDataJson = world.getDynamicProperty(WARP_DYNAMIC_PROPERTY);
    if (!warpDataJson) {
        player.sendMessage('§7[§c-§7] §cNo warps are set.');
        return system.run(() => player.runCommand(`playsound random.break @s`));
    }

    const warps = JSON.parse(warpDataJson);

    if (!warps[warpName]) {
        player.sendMessage(`§7[§c-§7] §cWarp §e${warpName} §cdoes not exist.`);
        return system.run(() => player.runCommand(`playsound random.break @s`));
    }

    const warp = warps[warpName];

    if (teleportingPlayers.has(player.id)) {
        player.sendMessage('§7[§c-§7] §cYou are already in the process of teleporting. Please wait.');
        return;
    }

    const initialPosition = { x: player.location.x, y: player.location.y, z: player.location.z };
    player.sendMessage(`§7[§a/§7] §aTeleporting to warp §e${warpName} §ain §e5 seconds§a. Do not move!`);

    teleportingPlayers.set(player.id, { initialPosition, countdown: 5, warp, warpName });

    const countdownInterval = system.runInterval(() => {
        const playerData = teleportingPlayers.get(player.id);
        if (!playerData || !player) {
            system.clearRun(countdownInterval);
            teleportingPlayers.delete(player.id);
            return;
        }

        if (player.hasTag("isCombat")) {
            player.sendMessage("§7[§c!§7] §cTeleport cancelled - you entered combat!");
            system.run(() => player.runCommand('playsound random.break @s'));
            system.clearRun(countdownInterval);
            teleportingPlayers.delete(player.id);
            return;
        }

        const { countdown, initialPosition, warp, warpName } = playerData;
        const currentPosition = { x: player.location.x, y: player.location.y, z: player.location.z };

        if (
            currentPosition.x !== initialPosition.x ||
            currentPosition.y !== initialPosition.y ||
            currentPosition.z !== initialPosition.z
        ) {
            player.sendMessage('§7[§c-§7] §cTeleportation canceled because you moved.');
            system.run(() => player.runCommand('playsound random.break @s'));
            teleportingPlayers.delete(player.id);
            system.clearRun(countdownInterval);
            return;
        }

        playerData.countdown -= 1;

        if (playerData.countdown > 0) {
            player.sendMessage(`§7[§a/§7] §aTeleporting in §e${playerData.countdown} seconds§a...`);
            system.run(() => player.runCommand('playsound random.orb @s'));
        } else {
            system.clearRun(countdownInterval);

            const x = warp.location ? warp.location.x : warp.x;
            const y = warp.location ? warp.location.y : warp.y;
            const z = warp.location ? warp.location.z : warp.z;
            const dimension = warp.dimension === "minecraft:overworld" ? "overworld" :
                              warp.dimension === "minecraft:nether" ? "nether" : "the_end";
            
            system.run(() => {
                try {
                    player.runCommand(`execute in ${dimension} run tp @s ${x} ${y} ${z}`);
                    player.sendMessage(`§7[§a/§7] §aTeleported to warp §e${warpName}§a.`);
                    player.runCommand(`playsound random.levelup @s`);
                } catch (error) {
                    player.sendMessage('§7[§c-§7] §cError: Unable to teleport. Please try again.');
                    console.error(`Teleport error: ${error.message}`);
                }
            });

            teleportingPlayers.delete(player.id);
        }
    }, 20);
}

export function showSetWarpForm(player) {
    const form = new ModalFormData()
        .title("§l§bBlueMods §7| §aSet New Warp")
        .textField("Enter warp name:", "Name");

    form.show(player).then((response) => {
        if (response.canceled) return;
        
        const [warpName] = response.formValues;
        if (!warpName || warpName.trim() === "") {
            player.sendMessage("§7[§c-§7] §cWarp name cannot be empty!");
            return;
        }

        setWarp(player, warpName.trim());
        showWarpsUI(player);
    }).catch((error) => {
        console.error("Set Warp Form Error:", error);
        player.sendMessage("§7[§c-§7] §cFailed to set warp");
    });
}

export function showRemoveWarpForm(player) {
    const warpDataJson = world.getDynamicProperty(WARP_DYNAMIC_PROPERTY);
    const warps = warpDataJson ? JSON.parse(warpDataJson) : {};

    if (Object.keys(warps).length === 0) {
        player.sendMessage("§7[§c-§7] §cNo warps available to remove!");
        return;
    }

    const form = new ModalFormData()
        .title("§l§bBlueMods §7| §cRemove Warp")
        .dropdown("Select warp to remove:", Object.keys(warps));

    form.show(player).then((response) => {
        if (response.canceled) return;
        
        const [selectedIndex] = response.formValues;
        const warpName = Object.keys(warps)[selectedIndex];
        
        removeWarp(player, warpName);
        showWarpsUI(player);
    }).catch((error) => {
        console.error("Remove Warp Form Error:", error);
        player.sendMessage("§7[§c-§7] §cFailed to remove warp");
    });
}

export function setWarp(player, warpName) {
    const warpDataJson = world.getDynamicProperty(WARP_DYNAMIC_PROPERTY);
    const warps = warpDataJson ? JSON.parse(warpDataJson) : {};

    warps[warpName] = {
        location: {
            x: player.location.x,
            y: player.location.y,
            z: player.location.z
        },
        dimension: player.dimension.id,
        creator: player.name
    };

    world.setDynamicProperty(WARP_DYNAMIC_PROPERTY, JSON.stringify(warps));
    player.sendMessage(`§7[§a+§7] §aWarp §e${warpName} §asaved successfully!`);
}

export function removeWarp(player, warpName) {
    const warpDataJson = world.getDynamicProperty(WARP_DYNAMIC_PROPERTY);
    const warps = warpDataJson ? JSON.parse(warpDataJson) : {};

    if (warps[warpName]) {
        delete warps[warpName];
        world.setDynamicProperty(WARP_DYNAMIC_PROPERTY, JSON.stringify(warps));
        player.sendMessage(`§7[§a+§7] §cWarp §e${warpName} §cremoved.`);
    }
}