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

import { ModulesPanel } from "./moderation/playerModules.js";
import { ChatConfigurationPanel } from "./moderation/playerChat.js";
import { showPlayerLogs, showCommandLogs } from "./moderation/playerLogs.js";
import { CommandsPanel } from "./moderation/playerCommands.js";
import { ReportManagePanel } from "./selection/playerReport.js";

export function showModerationUI(player) {
    const form = new ActionFormData()
    .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §eModeration Menu")
    .body("Choose an option:");

    form.button(customFormUICodes.action.buttons.positions.main_only + "Modules", "textures/items/book_written")
        .button(customFormUICodes.action.buttons.positions.main_only + "Commands", "textures/items/book_portfolio")
        .button(customFormUICodes.action.buttons.positions.main_only + "Chat Modules", "textures/items/paper")
        .button(customFormUICodes.action.buttons.positions.main_only + "Manage Reports", "textures/ui/FriendsIcon")
        .button(customFormUICodes.action.buttons.positions.main_only + "Admin Logs", "textures/ui/icon_setting")
        .button(customFormUICodes.action.buttons.positions.main_only + "Commands Logs", "textures/ui/icon_setting");

    form.show(player).then((response) => {
        if (response.canceled) return;

        switch (response.selection) {
            case 0:
                ModulesPanel(player);
                player.playSound("note.pling", { pitch: 1, volume: 0.4 });
                break;
            case 1:
                CommandsPanel(player);
                player.playSound("note.pling", { pitch: 1, volume: 0.4 });
                break;
            case 2:
                ChatConfigurationPanel(player);
                player.playSound("note.pling", { pitch: 1, volume: 0.4 });
                break;
            case 3:
                ReportManagePanel(player);
                player.playSound("note.pling", { pitch: 1, volume: 0.4 });
                break;
            case 4:
                showPlayerLogs(player);
                player.playSound("note.pling", { pitch: 1, volume: 0.4 });
                break;
            case 5:
                showCommandLogs(player);
                player.playSound("note.pling", { pitch: 1, volume: 0.4 });
                break;
        }
    }).catch((error) => {
        console.error("§7[§c#§7] §rFailed to Show Compass UI:", error);
    });
}