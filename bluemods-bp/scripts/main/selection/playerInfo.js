import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
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
        name: "8Crafter",
        description: "BlueMods Contributor & UI Designer",
        social: [
        ]
    },
    mehmet: {
        name: "Mehmet303j",
        description: "Friend of the Creator & Contributor",
        social: [
            "dsc.gg/lekoji-bedrock"
        ]
    }
};

export function showInfoUI(player) {
    const blueshadowSocials = user.blueshadow.social.map(link => `§e- §f${link}`).join("\n");
    const crafterSocials = user.crafter.social.length > 0 ? "\n" + user.crafter.social.map(link => `§e- §f${link}`).join("\n") : "";
    const mehmetSocials = user.mehmet.social.length > 0 ? "\n" + user.mehmet.social.map(link => `§e- §f${link}`).join("\n") : "";

    const betaTesters = main.beta || [];
    const betaList = betaTesters.length > 0
        ? "\n\n\n§l§eBeta Testers:§r\n" + betaTesters.map(name => `§e- §f${name}`).join("\n")
        : "";

    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aAddon §gInfo")
        .body(
            `§b${user.blueshadow.name} §7- §f${user.blueshadow.description}\n${blueshadowSocials}\n\n` +
            `§b${user.crafter.name} §7- §f${user.crafter.description}${crafterSocials}\n\n` +
            `§b${user.mehmet.name} §7- §f${user.mehmet.description}${mehmetSocials}${betaList}`
        );
    
    form.button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled) return;

        switch (response.selection) {
            case 0:
                showCompassUI(player);
                system.run(() => player.runCommand('playsound note.pling @s'));
                break;
        }
    }).catch((error) => {
        console.error("§7[§c#§7] §rFailed to Show Info UI:", error);
    });
}