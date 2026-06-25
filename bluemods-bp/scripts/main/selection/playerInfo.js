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

const user = {
    blueshadow: {
        name: "BlueShadow",
        description: "BlueMods Developer & Creator",
        social: [
            "dsc.gg/bluemods",
            "bluemods.neocities.org",
            "youtube.com/@bluemodsyt",
            "x.com/bluemodsyt",
            "mcpedl.com/bluemods",
            "tiktok.com/@bluemodsyt",
            "modbay.org/user/BlueMods/",
            "curseforge.com/members/bluemods/"
        ]
    },
    crafter: {
        name: "8crafter",
        description: "BlueMods Contributor",
        social: []
    }
};

export function showInfoUI(player) {
    const blueshadowSocials = user.blueshadow.social.map(link => `§e- §f${link}`).join("\n");
    const crafterSocials = user.crafter.social.length > 0 
        ? "\n" + user.crafter.social.map(link => `§e- §f${link}`).join("\n") 
        : "";

    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aAddon §gInfo")
        .body(
            `§b${user.blueshadow.name} §7- §f${user.blueshadow.description}\n${blueshadowSocials}\n\n` +
            `§b${user.crafter.name} §7- §f${user.crafter.description}${crafterSocials}`
        );
    
    form.button(customFormUICodes.action.buttons.positions.title_bar_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled) return;

        switch (response.selection) {
            case 0:
                showCompassUI(player);
                player.playSound("note.pling", { pitch: 1, volume: 0.4 });
                break;
        }
    }).catch((error) => {
        console.error("§7[§c#§7] §rFailed to Show Info UI:", error);
    });
}