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

const LOGS_DYNAMIC_PROPERTY = "bluemods:player_logs";
const COMMAND_LOGS_DYNAMIC_PROPERTY = "bluemods:command_logs";
const MAX_LOGS = 30;

export function addLog(playerName, action, details = "") {
    try {
        const logsJson = world.getDynamicProperty(LOGS_DYNAMIC_PROPERTY);
        const logs = logsJson ? JSON.parse(logsJson) : [];
        logs.unshift({ player: playerName, action: action, details: details, timestamp: Date.now(), date: new Date().toLocaleString() });
        if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
        world.setDynamicProperty(LOGS_DYNAMIC_PROPERTY, JSON.stringify(logs));
    } catch (error) {}
}

function getLogs() {
    try { const logsJson = world.getDynamicProperty(LOGS_DYNAMIC_PROPERTY); return logsJson ? JSON.parse(logsJson) : []; } catch { return []; }
}

function getCommandLogs() {
    try {
        const logsJson = world.getDynamicProperty(COMMAND_LOGS_DYNAMIC_PROPERTY);
        return logsJson ? JSON.parse(logsJson) : [];
    } catch {
        return [];
    }
}

export function addCommandLog(playerName, command, target = "", args = "") {
    try {
        const logsJson = world.getDynamicProperty(COMMAND_LOGS_DYNAMIC_PROPERTY);
        const logs = logsJson ? JSON.parse(logsJson) : [];
        
        const logEntry = {
            player: playerName,
            command: command,
            target: target,
            args: args,
            timestamp: Date.now(),
            date: new Date().toLocaleString()
        };
        
        logs.unshift(logEntry);
        
        if (logs.length > 50) {
            logs.length = 50;
        }
        
        world.setDynamicProperty(COMMAND_LOGS_DYNAMIC_PROPERTY, JSON.stringify(logs));
    } catch (error) {
        console.error("Failed to save command log:", error);
    }
}

export function showCommandLogs(player, page = 0) {
    const logs = getCommandLogs();
    const logsPerPage = 10;
    const totalPages = Math.ceil(logs.length / logsPerPage);
    const start = page * logsPerPage;
    const end = start + logsPerPage;
    const pageLogs = logs.slice(start, end);
    
    if (logs.length === 0) {
        const form = new ActionFormData()
            .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aCommand Logs")
            .body("§7No command logs available.")
            .button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");
        
        form.show(player).then(response => {
            if (response.canceled) return;
            showModerationUI(player);
        });
        return;
    }
    
    const form = new ActionFormData()
        .title("§l§bBlueMods §7| §aCommand Logs")
        .body(`§7Page §e${page + 1} §7of §e${totalPages}\n§7Total logs: §e${logs.length}`);
    
    pageLogs.forEach(log => {
        const time = new Date(log.timestamp).toLocaleString();
        const targetText = log.target ? ` §7-> §e${log.target}` : "";
        form.button(customFormUICodes.action.buttons.positions.main_only + 
            `§e${log.player}${targetText}\n§7${log.command} §8- §7${time}`,
            "textures/ui/icon_book_writable"
        );
    });
    
    if (page > 0) {
        form.button(customFormUICodes.action.buttons.positions.left_side_only + "§aPrevious Page", "textures/ui/arrow_left");
    }
    if (page < totalPages - 1) {
        form.button(customFormUICodes.action.buttons.positions.left_side_only + "§aNext Page", "textures/ui/arrow_right");
    }
    form.button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");
    
    form.show(player).then(response => {
        if (response.canceled) return;
        
        const selection = response.selection;
        
        if (selection < pageLogs.length) {
            const log = pageLogs[selection];
            showCommandLogDetails(player, log, page);
        } else if (selection === pageLogs.length && page > 0) {
            showCommandLogs(player, page - 1);
        } else if ((selection === pageLogs.length + (page > 0 ? 1 : 0)) && page < totalPages - 1) {
            showCommandLogs(player, page + 1);
        } else {
            showModerationUI(player);
        }
    });
}

function showCommandLogDetails(player, log, returnPage) {
    const targetText = log.target ? `§7Target: §e${log.target}\n\n` : "";
    
    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aCommand Log Details")
        .body(
            `§7Executor: §e${log.player}\n\n` +
            targetText +
            `§7Command: §e${log.command}\n\n` +
            `§7Args: §e${log.args || "None"}\n\n` +
            `§7Date: §e${log.date}`
        )
        .button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");
    
    form.show(player).then(response => {
        if (response.canceled) return;
        showCommandLogs(player, returnPage);
    });
}

export function showPlayerLogs(player, page = 0) {
    const logs = getLogs();
    const logsPerPage = 10;
    const totalPages = Math.ceil(logs.length / logsPerPage);
    const start = page * logsPerPage;
    const end = start + logsPerPage;
    const pageLogs = logs.slice(start, end);
    
    if (logs.length === 0) {
        const form = new ActionFormData()
            .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aPlayer Logs")
            .body("§7No logs available.")
            .button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");
        
        form.show(player).then(response => {
            if (response.canceled) return;
            showModerationUI(player);
        });
        return;
    }
    
    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aPlayer Logs")
        .body(`§7Page §e${page + 1} §7of §e${totalPages}\n§7Total logs: §e${logs.length}`);
    
    pageLogs.forEach(log => {
        const time = new Date(log.timestamp).toLocaleString();
        const icon = getLogIcon(log.action);
        form.button(customFormUICodes.action.buttons.positions.main_only + 
            `§e${log.player}\n§7${log.action} §8- §7${time}`,
            icon
        );
    });
    
    if (page > 0) {
        form.button(customFormUICodes.action.buttons.positions.left_side_only + "§aPrevious Page", "textures/ui/arrow_left");
    }
    if (page < totalPages - 1) {
        form.button(customFormUICodes.action.buttons.positions.left_side_only + "§aNext Page", "textures/ui/arrow_right");
    }
    form.button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");
    
    form.show(player).then(response => {
        if (response.canceled) return;
        
        const selection = response.selection;
        const navOffset = (page > 0 ? 1 : 0) + (page < totalPages - 1 ? 1 : 0);
        
        if (selection < pageLogs.length) {
            const log = pageLogs[selection];
            showLogDetails(player, log, page);
        } else if (selection === pageLogs.length && page > 0) {
            showPlayerLogs(player, page - 1);
        } else if ((selection === pageLogs.length + (page > 0 ? 1 : 0)) && page < totalPages - 1) {
            showPlayerLogs(player, page + 1);
        } else {
            showModerationUI(player);
        }
    });
}

function showLogDetails(player, log, returnPage) {
    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aLog Details")
        .body(
            `§7Player: §e${log.player}\n\n` +
            `§7Action: §e${log.action}\n\n` +
            `§7Details: §e${log.details || "None"}\n\n` +
            `§7Date: §e${log.date}\n\n` +
            `§7Timestamp: §e${log.timestamp}`
        )
        .button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");
    
    form.show(player).then(response => {
        if (response.canceled) return;
        showPlayerLogs(player, returnPage);
    });
}

function getLogIcon(action) {
    switch (action) {
        case "Illegal Item": return "textures/blocks/barrier";
        case "Illegal Enchantment": return "textures/items/book_enchanted";
        case "Name Spoof": return "textures/ui/icon_rename";
        case "NBT Violation": return "textures/items/book_writable";
        case "Combat Log": return "textures/items/diamond_sword";
        case "Creative Mode": return "textures/ui/creative_icon";
        case "Lored Item": return "textures/items/name_tag";
        case "Entity Spawn": return "textures/items/spawn_egg";
        case "Dupe Bundle": return "textures/items/bundle";
        case "Bundle Inventory": return "textures/items/bundle";
        case "Dupe Bundle Crafter": return "textures/items/bundle";
        case "X-ray Detector": return "textures/items/diamond";
        case "CPS/Clicks Detector": return "textures/items/blaze_powder";
        case "Global Banned": return "textures/blocks/barrier";
        case "Banned Item": return "textures/ui/icon_recipe_item";
        default: return "textures/ui/info";
    }
}

function clearLogs(player) {
    world.setDynamicProperty(LOGS_DYNAMIC_PROPERTY, JSON.stringify([]));
    player.sendMessage("§7[§a+§7] §aAll player logs have been cleared.");
}

export function clearCommandLogs(player) {
    world.setDynamicProperty(COMMAND_LOGS_DYNAMIC_PROPERTY, JSON.stringify([]));
    player.sendMessage("§7[§a+§7] §aAll Command logs have been cleared.");
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "bluemods:clearlogs") {
        const player = event.sourceEntity;
        if (player && player.typeId === "minecraft:player") {
            clearLogs(player);
        }
    }
    if (event.id === "bluemods:clearcommandlogs") {
        const player = event.sourceEntity;
        if (player && player.typeId === "minecraft:player") {
            clearCommandLogs(player);
        }
    }
});