import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { customFormUICodes } from "../handler/customFormUICodes.js";
import main from "../config.js";

//░███░░██░░██░░█░████░██░░██░░████░░████░░░███░
//░█░░█░█░░░░█░░█░█░░░░██░░██░█░░░█░░█░░░█░█░░█░
//░███░░█░░░░█░░█░███░░██░░██░█░░░░█░█░░░█░██░░░
//░█░░█░█░░░░█░░█░█░░░░█░██░█░█░░░░█░█░░░█░░░█░░
//░█░░█░█░░█░█░░█░█░░█░█░██░█░█░░░█░░█░░░█░█░░█░
//░███░░████░███░░████░█░█░░█░░███░░░████░░███░░
// https://dsc.gg/bluemods

function isCommandEnabled(commandName) {
    return main.enabledCommands[commandName] !== undefined ? main.enabledCommands[commandName] : true;
}

const isAuthorized = (player, commandName) => {
    if (!isCommandEnabled(commandName)) {
        player.sendMessage(`§7[§b#§7] §cThis command §e${commandName} §cis currently disabled.`);
        system.run(() => player.runCommand(`playsound random.break @s`));
        return false;
    }
    return true;
};

import { showWarpsUI } from "./selection/playerWarps.js";
import { showTeleportUI } from "./selection/playerTeleport.js";
import { showRandomTPUI } from "./selection/playerRandomTP.js";
import { showHomeUI } from "./selection/playerHomes.js";
import { showReportUI } from "./selection/playerReport.js";
import { showInfoUI } from "./selection/playerInfo.js";

export function showCompassUI(player) {
    const form = new ActionFormData()
    .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aSelection Menu")
    .body("Choose an option:");

    form.button(customFormUICodes.action.buttons.positions.main_only + "Warps", "textures/items/compass_item")
        .button(customFormUICodes.action.buttons.positions.main_only + "TPA Request", "textures/items/ender_pearl")
        .button(customFormUICodes.action.buttons.positions.main_only + "Random Teleport", "textures/items/redstone_dust")
        .button(customFormUICodes.action.buttons.positions.main_only + "Homes", "textures/items/bed_red")
        .button(customFormUICodes.action.buttons.positions.main_only + "Report User", "textures/ui/FriendsIcon")
        .button(customFormUICodes.action.buttons.positions.main_only + "Addon Info", "textures/ui/icon_fall");

    form.show(player).then((response) => {
        if (response.canceled) return;

        switch (response.selection) {
            case 0:
                if (!isAuthorized(player, "warp")) return;
                showWarpsUI(player);
                player.playSound("note.pling", { pitch: 1, volume: 0.4 });
                break;
            case 1:
                if (!isAuthorized(player, "tpa")) return;
                showTeleportUI(player);
                player.playSound("note.pling", { pitch: 1, volume: 0.4 });
                break;
            case 2:
                if (!isAuthorized(player, "rtp")) return;
                showRandomTPUI(player);
                player.playSound("note.pling", { pitch: 1, volume: 0.4 });
                break;
            case 3:
                if (!isAuthorized(player, "home")) return;
                showHomeUI(player);
                player.playSound("note.pling", { pitch: 1, volume: 0.4 });
                break;
            case 4:
                showReportUI(player);
                player.playSound("note.pling", { pitch: 1, volume: 0.4 });
                break;
            case 5:
                showInfoUI(player);
                player.playSound("note.pling", { pitch: 1, volume: 0.4 });
                break;
        }
    }).catch((error) => {
        console.error("§7[§c#§7] §rFailed to Show Compass UI:", error);
    });
}
