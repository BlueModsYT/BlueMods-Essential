import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
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

const COMMANDS_STATES_KEY = "enabledCommands";

export function CommandsPanel(player) {
    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aModules Toggle");

    const commandKeys = Object.keys(main.enabledCommands);

    for (const command of commandKeys) {
        const isEnabled = main.enabledCommands[command]; 
        const statusText = isEnabled ? "§aEnabled" : "§cDisabled";
        const statusIcon = isEnabled
            ? "textures/ui/realms_green_check.png"
            : "textures/ui/redX1.png";

        form.button(customFormUICodes.action.buttons.positions.main_only + `§e${command}\n§7[ ${statusText} §7]`, statusIcon);
    }

    const backButtonIndex = commandKeys.length;
    form.button(customFormUICodes.action.buttons.positions.title_bar_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === backButtonIndex + 1) return;

        if (response.selection === backButtonIndex) {
            return showModerationUI(player);
        }

        const selectedCommand = commandKeys[response.selection];
        main.enabledCommands[selectedCommand] = !main.enabledCommands[selectedCommand];

        saveEnabledCommands();

        player.sendMessage(`§7[§b#§7] §aToggled §e${selectedCommand} §7to §b${main.enabledCommands[selectedCommand] ? "Enabled" : "Disabled"}§7.`);
        system.run(() => player.runCommand("playsound note.bell @s"));

        CommandsPanel(player);
    }).catch((error) => {
        console.error("Failed to show modules panel:", error);
    });
}

function saveEnabledCommands() {
    world.setDynamicProperty(COMMANDS_STATES_KEY, JSON.stringify(main.enabledCommands));
}

system.run(() => {
    try {
        const storedStates = world.getDynamicProperty(COMMANDS_STATES_KEY);
        if (storedStates) {
            main.enabledCommands = JSON.parse(storedStates);
        }
    } catch (error) {
        console.error(`Error loading enabled commands: ${error.message}`);
    }
});