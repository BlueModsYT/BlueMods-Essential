import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { banPlayer, parseCustomDuration } from "../commands/staff-commands.js";
import main from "../config.js";

//░███░░██░░██░░█░████░██░░██░░████░░████░░░███░
//░█░░█░█░░░░█░░█░█░░░░██░░██░█░░░█░░█░░░█░█░░█░
//░███░░█░░░░█░░█░███░░██░░██░█░░░░█░█░░░█░██░░░
//░█░░█░█░░░░█░░█░█░░░░█░██░█░█░░░░█░█░░░█░░░█░░
//░█░░█░█░░█░█░░█░█░░█░█░██░█░█░░░█░░█░░░█░█░░█░
//░███░░████░███░░████░█░█░░█░░███░░░████░░███░░
// https://dsc.gg/bluemods

function getLookedAtPlayer(player) {
    const entities = player.dimension.getEntities({
        type: "minecraft:player",
        location: player.location,
        maxDistance: 10
    });
    
    let closestPlayer = null;
    let closestDistance = Infinity;
    
    for (const entity of entities) {
        if (entity.id === player.id) continue;
        
        const dist = Math.sqrt(
            Math.pow(entity.location.x - player.location.x, 2) +
            Math.pow(entity.location.y - player.location.y, 2) +
            Math.pow(entity.location.z - player.location.z, 2)
        );
        
        if (dist < closestDistance) {
            closestDistance = dist;
            closestPlayer = entity;
        }
    }
    
    if (closestPlayer && closestDistance <= 6) {
        return closestPlayer;
    }
    
    return null;
}

function showModActionUI(player, target) {
    const form = new ActionFormData()
        .title(`§l§bBlueMods §7| §aManage §e${target.name}`)
        .body(`What would you like to do?`)
        .button("§cBan Player", "textures/blocks/barrier")
        .button("§cKick Player", "textures/ui/icon_sign")
        .button("§eMute Player", "textures/ui/chat_send")
        .button("§dClear Inventory", "textures/items/chest_minecart")
        .button("§bClear Effects", "textures/ui/wind_charged_effect")
        .button("§5Clear Ender Chest", "textures/items/ender_pearl");

    form.show(player).then(response => {
        if (response.canceled) return;
        
        switch (response.selection) {
            case 0:
                showBanForm(player, target);
                break;
            case 1:
                showKickForm(player, target);
                break;
            case 2:
                toggleMute(player, target);
                break;
            case 3:
                clearInventory(player, target);
                break;
            case 4:
                clearEffects(player, target);
                break;
            case 5:
                clearEnderChest(player, target);
                break;
        }
    });
}

function showBanForm(player, target) {
    const form = new ModalFormData()
        .title(`§l§cBan §e${target.name}`)
        .textField("Reason:", "Griefing")
        .textField("Duration (s/m/h/d/w):", "7d");

    form.show(player).then(response => {
        if (response.canceled) {
            showModActionUI(player, target);
            return;
        }
        
        const [reason, duration] = response.formValues;
        const finalReason = reason || "No reason specified";
        
        if (duration && parseCustomDuration(duration)) {
            banPlayer(target.name, finalReason, player, duration);
        } else {
            banPlayer(target.name, finalReason, player);
        }
        
        player.sendMessage(`§7[§a+§7] §aBanned §e${target.name}§a. Reason: §e${finalReason}`);
    });
}

function showKickForm(player, target) {
    const form = new ModalFormData()
        .title(`§l§cKick §e${target.name}`)
        .textField("Reason:", "Breaking rules");

    form.show(player).then(response => {
        if (response.canceled) {
            showModActionUI(player, target);
            return;
        }
        
        const [reason] = response.formValues;
        const finalReason = reason || "No reason specified";
        
        target.runCommand(`kick "${target.name}" ${finalReason}`);
        player.sendMessage(`§7[§a+§7] §aKicked §e${target.name}§a. Reason: §e${finalReason}`);
    });
}

function toggleMute(player, target) {
    if (target.hasTag("isMuted")) {
        target.removeTag("isMuted");
        target.sendMessage(`§7[§a!§7] §aYou have been unmuted.`);
        player.sendMessage(`§7[§a+§7] §aUnmuted §e${target.name}§a.`);
    } else {
        target.addTag("isMuted");
        target.sendMessage(`§7[§c!§7] §cYou have been muted.`);
        player.sendMessage(`§7[§a+§7] §aMuted §e${target.name}§a.`);
    }
    showModActionUI(player, target);
}

function clearInventory(player, target) {
    target.runCommand("clear @s");
    target.sendMessage(`§7[§c!§7] §cYour inventory has been cleared.`);
    player.sendMessage(`§7[§a+§7] §aCleared §e${target.name}'s §ainventory.`);
    
    world.getPlayers({ tags: ["notify"] }).forEach(admin => {
        admin.sendMessage(`§7[§e#§7] §e${player.name} §acleared §e${target.name}'s §ainventory.`);
    });
}

function clearEffects(player, target) {
    target.runCommand("effect @s clear");
    target.sendMessage(`§7[§c!§7] §cYour effects have been cleared.`);
    player.sendMessage(`§7[§a+§7] §aCleared §e${target.name}'s §aeffects.`);
}

function clearEnderChest(player, target) {
    for (let i = 0; i < 27; i++) {
        target.runCommand(`replaceitem entity @s slot.enderchest ${i} air`);
    }
    target.sendMessage(`§7[§c!§7] §cYour ender chest has been cleared.`);
    player.sendMessage(`§7[§a+§7] §aCleared §e${target.name}'s §aender chest.`);
    
    world.getPlayers({ tags: ["notify"] }).forEach(admin => {
        admin.sendMessage(`§7[§e#§7] §e${player.name} §acleared §e${target.name}'s §aender chest.`);
    });
}

world.afterEvents.itemUse.subscribe((event) => {
    const { itemStack, source } = event;
    
    if (source?.typeId !== "minecraft:player") return;
    if (itemStack.typeId !== "bluemods:modmenu") return;
    if (!source.hasTag(main.adminTag)) return;
    
    const player = source;
    
    const lookedAtPlayer = getLookedAtPlayer(player);
    
    if (lookedAtPlayer) {
        showModActionUI(player, lookedAtPlayer);
    }
    
    player.playSound("note.pling", { pitch: 1, volume: 0.4 });
});
