import { world } from "@minecraft/server";
import { showCompassUI } from "./playerCompass.js";
import { showModerationUI } from "./playerModeration.js";
import main from "../config.js";

//░███░░██░░██░░█░████░██░░██░░████░░████░░░███░
//░█░░█░█░░░░█░░█░█░░░░██░░██░█░░░█░░█░░░█░█░░█░
//░███░░█░░░░█░░█░███░░██░░██░█░░░░█░█░░░█░██░░░
//░█░░█░█░░░░█░░█░█░░░░█░██░█░█░░░░█░█░░░█░░░█░░
//░█░░█░█░░█░█░░█░█░░█░█░██░█░█░░░█░░█░░░█░█░░█░
//░███░░████░███░░████░█░█░░█░░███░░░████░░███░░
// https://dsc.gg/bluemods

// function isBeta(player) {
    // const betaList = main.beta || [];
    // return betaList.includes(player.name);
// }

// world.afterEvents.itemUse.subscribe((event) => {
    // const { itemStack, source } = event;

    // if (source?.typeId !== "minecraft:player") return;
    
    // if (itemStack.typeId === "bluemods:itemui") {
        // if (!isBeta(source)) {
            // source.playSound("random.anvil_land", { pitch: 1, volume: 0.4 });
            // return;
        // }
        // showCompassUI(source);
        // source.playSound("note.pling", { pitch: 1, volume: 0.4 });
    // }

    // if (itemStack.typeId === "bluemods:modmenu") {
        // if (!isBeta(source)) {
            // source.playSound("random.anvil_land", { pitch: 1, volume: 0.4 });
            // return;
        // }

        // showModerationUI(source);
        // source.playSound("note.pling", { pitch: 1, volume: 0.4 });
    // }
// });

world.afterEvents.itemUse.subscribe((event) => {
    const { itemStack, source } = event;

    if (source?.typeId !== "minecraft:player") return;
    
    if (itemStack.typeId === "bluemods:itemui") {
        showCompassUI(source);
        source.playSound("note.pling", { pitch: 1, volume: 0.4 });
    }

    if (itemStack.typeId === "bluemods:modmenu") {
        if (!source.hasTag(main.adminTag)) {
            source.playSound("random.anvil_land", { pitch: 1, volume: 0.4 });
            return;
        }

        showModerationUI(source);
        source.playSound("note.pling", { pitch: 1, volume: 0.4 });
    }
    
});