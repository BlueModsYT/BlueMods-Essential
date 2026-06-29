import { world } from "@minecraft/server";
import { isProjectiles } from "../../items.js";

//░███░░██░░██░░█░████░██░░██░░████░░████░░░███░
//░█░░█░█░░░░█░░█░█░░░░██░░██░█░░░█░░█░░░█░█░░█░
//░███░░█░░░░█░░█░███░░██░░██░█░░░░█░█░░░█░██░░░
//░█░░█░█░░░░█░░█░█░░░░█░██░█░█░░░░█░█░░░█░░░█░░
//░█░░█░█░░█░█░░█░█░░█░█░██░█░█░░░█░░█░░░█░█░░█░
//░███░░████░███░░████░█░█░░█░░███░░░████░░███░░
// https://dsc.gg/bluemods

world.afterEvents.projectileHitEntity.subscribe((data) => {
    const entityHit = data.getEntityHit()?.entity;
    const source = data.source;
    
    if (!(entityHit?.typeId === "minecraft:player" && source?.typeId === "minecraft:player")) return;
    
    if (source.getGameMode() === "creative") return;
    if (entityHit.getGameMode() === "creative") return;
    
    const projectile = data.projectile.typeId;
    
    if (isProjectiles.includes(projectile)) {
        system.run(() => source.runCommand('playsound random.orb @s'));
    }
});