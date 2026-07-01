import { world, system } from "@minecraft/server";
import { addCommandLog } from "../main/moderation/playerLogs.js";
import main from "../config.js";

//░███░░██░░██░░█░████░██░░██░░████░░████░░░███░
//░█░░█░█░░░░█░░█░█░░░░██░░██░█░░░█░░█░░░█░█░░█░
//░███░░█░░░░█░░█░███░░██░░██░█░░░░█░█░░░█░██░░░
//░█░░█░█░░░░█░░█░█░░░░█░██░█░█░░░░█░█░░░█░░░█░░
//░█░░█░█░░█░█░░█░█░░█░█░██░█░█░░░█░░█░░░█░█░░█░
//░███░░████░███░░████░█░█░░█░░███░░░████░░███░░
// https://dsc.gg/bluemods

function isAuthorized(player, commandName) {
    if (main.enabledCommands[commandName] !== undefined) {
        return main.enabledCommands[commandName];
    }
    return true;
}

function getCommandDescription(commandName) {
    for (const category of main.memberCategories) {
        for (const cmd of category.commands) {
            if (cmd.text.includes(`!${commandName}`)) {
                return cmd.description;
            }
        }
    }
    for (const category of main.adminCategories) {
        for (const cmd of category.commands) {
            if (cmd.text.includes(`!${commandName}`)) {
                return cmd.description;
            }
        }
    }
    return "No description provided.";
}

class Commands {
    constructor() {
        this.registeredCommands = [];
    }

    register(info, callback) {
        const command = {
            name: info.name.toLowerCase().split(' ')[0],
            description: getCommandDescription(info.name.toLowerCase()),
            aliases: info.aliases?.map(aL => aL.toLowerCase().split(' ')[0]) ?? [],
            permission: info.permission ?? (() => true),
            callback
        };
        this.registeredCommands.push(command);
    }

    remove(command) {
        const index = this.registeredCommands.findIndex(cmd => cmd.name === command.toLowerCase());
        if (index !== -1) {
            this.registeredCommands.splice(index, 1);
        }
    }

    forEach(callback, thisArg) {
        this.registeredCommands.forEach(callback, thisArg);
    }

    clear() {
        this.registeredCommands = [];
    }
}

export const Command = new Commands();

world.beforeEvents.chatSend.subscribe((data) => {
    const { message, sender: player } = data;
    const prefix = main.prefix;

    if (!message.startsWith(prefix)) return;

    data.cancel = true;

    const args = message
        .substring(prefix.length)
        .replace(/@(?=\w{2})|@(?!s)/g, '')
        .trim()
        .replace(/ {2,}/g, ' ')
        .match(/".*?"|[\S]+/g)
        ?.map(item => item.replaceAll('"', '')) ?? [];

    const cmd = args.shift()?.toLowerCase(); 
    const cmdData = Command.registeredCommands.find(c => c.name === cmd || c.aliases.includes(cmd));

    if (!cmdData) {
        system.run(() => player.playSound("random.anvil_land", { pitch: 1, volume: 0.4 }));
        player.sendMessage(`§7[§c-§7] §cUnknown command: §g${message.replace(prefix, '')}§c. Please check that the command exists and that you have permission to use it.`);
        return;
    }
    
    if (!isAuthorized(player, cmdData.name)) {
        system.run(() => player.playSound("random.anvil_land", { pitch: 1, volume: 0.4 }));
        player.sendMessage(`§7[§c-§7] §cThis command is currently disabled. Please check that the command exists and that you have permission to use it.`);
        return;
    }
    
    if (cmdData.permission && !cmdData.permission(player)) {
        system.run(() => player.playSound("random.anvil_land", { pitch: 1, volume: 0.4 }));
        player.sendMessage(`§7[§c-§7] §cYou do not have permission to use this command.`);
        return;
    }

    addCommandLog(player.name, cmdData.name, args.join(" "));

    cmdData.callback({ player, message }, args);
});