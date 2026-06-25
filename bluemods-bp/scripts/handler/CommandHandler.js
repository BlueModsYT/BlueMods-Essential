import { world } from "@minecraft/server";
import main from "../config.js";

//░███░░██░░██░░█░████░██░░██░░████░░████░░░███░
//░█░░█░█░░░░█░░█░█░░░░██░░██░█░░░█░░█░░░█░█░░█░
//░███░░█░░░░█░░█░███░░██░░██░█░░░░█░█░░░█░██░░░
//░█░░█░█░░░░█░░█░█░░░░█░██░█░█░░░░█░█░░░█░░░█░░
//░█░░█░█░░█░█░░█░█░░█░█░██░█░█░░░█░░█░░░█░█░░█░
//░███░░████░███░░████░█░█░░█░░███░░░████░░███░░
// https://dsc.gg/bluemods

class Commands {
    constructor() {
        this.registeredCommands = [];
    }

    register(info, callback) {
        const command = {
            name: info.name.toLowerCase().split(' ')[0],
            description: info.description ?? "No description provided.",
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
        player.sendMessage(`§7[§c-§7] §cUnknown command: §g${message.replace(prefix, '')}§c. Please check that the command exists and that you have permission to use it.`);
        return;
    }

    if (cmdData.permission && !cmdData.permission(player)) {
        player.sendMessage(`§7[§c-§7] §cYou do not have permission to use this command.`);
        return;
    }

    cmdData.callback({ player, message }, args);
});