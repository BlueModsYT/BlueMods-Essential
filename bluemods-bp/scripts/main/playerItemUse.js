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