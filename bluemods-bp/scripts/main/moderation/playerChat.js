import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { Command } from "../../handler/CommandHandler.js";
import { showModerationUI } from "../playerModeration.js";
import { badWords } from "../../words.js";
import { customFormUICodes } from "../../handler/customFormUICodes.js";
import main from "../../config.js";

//░███░░██░░██░░█░████░██░░██░░████░░████░░░███░
//░█░░█░█░░░░█░░█░█░░░░██░░██░█░░░█░░█░░░█░█░░█░
//░███░░█░░░░█░░█░███░░██░░██░█░░░░█░█░░░█░██░░░
//░█░░█░█░░░░█░░█░█░░░░█░██░█░█░░░░█░█░░░█░░░█░░
//░█░░█░█░░█░█░░█░█░░█░█░██░█░█░░░█░░█░░░█░█░░█░
//░███░░████░███░░████░█░█░░█░░███░░░████░░███░░
// https://dsc.gg/bluemods

const debugSticksHasDisabledChatModification = false;
const debug_sticks_format_version = null;

const CHAT_CONFIG_STATES_KEY = "chatConfigStatesKey";

const lastMessages = new Map();
const messageCooldown = new Map();

function isCommandEnabled(commandName) {
    return main.enabledCommands[commandName] !== undefined ? main.enabledCommands[commandName] : true;
}

const isAuthorized = (player, commandName) => {
    if (!isCommandEnabled(commandName)) {
        player.sendMessage(`§7[§b#§7] §cThis command §e${commandName} §cis currently disabled.`);
        system.run(() => player.runCommand(`playsound random.break @s`));
        return false;
    }
    return true;
};

function getChatFormat() {
    const format = world.getDynamicProperty(`globalChatFormat`);
    return format || "§l§7<§r{rank}§l§7>§r§7 {name} §l§b»§r §f{message}";
}

function setChatFormat(format) {
    world.setDynamicProperty(`globalChatFormat`, format);
}

function removeChatFormat() {
    world.setDynamicProperty(`globalChatFormat`, null);
}

function containsBadWords(message) {
    const lowerCaseMessage = message.toLowerCase();
    const regex = new RegExp(`\\b(${badWords.join("|")})\\b`, "gi");
    return regex.test(lowerCaseMessage);
}

function handleBadWords(player, message) {
    if (player.hasTag(main.adminTag)) return false;

    if (containsBadWords(message)) {
        player.sendMessage(`§7[§b#§7] §cPlease refrain from using inappropriate language.`);
        system.run(() => player.runCommand(`playsound random.break @s`));
        return true;
    }
    return false;
}

function handleDuplicateMessage(player, message) {
    if (player.hasTag(main.adminTag)) return false;

    const playerName = player.name;
    const normalizedMessage = message.trim().toLowerCase();
    const lastMessage = lastMessages.get(playerName);

    if (lastMessage === normalizedMessage) {
        player.sendMessage("§7[§b#§7] §cPlease avoid sending duplicate messages.");
        system.run(() => player.runCommand("playsound random.break @s"));
        return true;
    }

    lastMessages.set(playerName, normalizedMessage);
    return false;
}

function isSpam(player) {
    if (player.hasTag(main.adminTag)) return false;

    const playerName = player.name;
    const lastTimeSent = messageCooldown.get(playerName) || 0;
    const currentTime = Date.now();

    if (currentTime - lastTimeSent < main.chatConfig.spamCooldown) {
        player.sendMessage("§7[§b#§7] §cYou are sending messages too quickly! Please wait.");
        system.run(() => player.runCommand("playsound random.break @s"));
        return true;
    }

    messageCooldown.set(playerName, currentTime);
    return false;
}

function formatChatMessage(player, message) {
    const tags = player.getTags();
    let ranks = tags.filter(tag => tag.startsWith('rank:')).map(tag => tag.replace('rank:', ''));

    const creatorRank = main.creatorRanks?.find(r => r.name === player.name);
    if (creatorRank) {
        ranks.unshift(`${creatorRank.icon} ${creatorRank.tag}`);
    }

    ranks = ranks.length ? ranks : ["§6Member"];
    const rankText = ranks.join(" §7|§f ");
    const format = getChatFormat();

    return format
        .replace("{rank}", rankText)
        .replace("{name}", player.nameTag)
        .replace("{message}", message);
}

function chat(data) {
    const sender = data.sender;

    if (sender.typeId !== "minecraft:player") {
        system.run(() => sender.runCommand("kick @s"));
        data.cancel = true;
        return;
    }

    const player = sender;
    const message = data.message;

    if ((!main.chatConfig.allowBadWords && handleBadWords(player, message)) || 
        (!main.chatConfig.allowDuplicateMessages && handleDuplicateMessage(player, message)) || 
        (!main.chatConfig.allowSpam && isSpam(player))) {
        data.cancel = true;
        return;
    }

    if (debug_sticks_format_version != null) {
        data.cancel = false;
        return;
    }
    
    const chatMessage = formatChatMessage(player, message);
    system.run(() => world.getDimension("overworld").runCommand(`tellraw @a {"rawtext":[{"text":${JSON.stringify(chatMessage)}}]}`));
    
    data.cancel = true;
}

Command.register({
    name: "chatdisplay",
    description: "",
    aliases: [],
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const { player } = data;
    if (!isAuthorized(player, "chatdisplay")) return;

    const action = args[0];
    const format = args.slice(1).join(" ");

    if (action === "set") {
        setChatFormat(format);
        player.sendMessage(`§7[§b#§7] §aSuccessfully updated chat format for everyone.`);
        system.run(() => player.runCommand(`playsound note.bell @s`));
    } else if (action === "remove") {
        removeChatFormat();
        player.sendMessage(`§7[§b#§7] §aChat format has been reset to default for everyone.`);
        system.run(() => player.runCommand(`playsound note.bell @s`));
    } else if (action === "enable") {
        world.setDynamicProperty("chatDisplayEnabled", true);
        player.sendMessage(`§7[§b#§7] §aSuccessfully Enabled Chat Display.`);
        system.run(() => player.runCommand(`playsound note.bell @s`));
    } else if (action === "disable") {
        world.setDynamicProperty("chatDisplayEnabled", false);
        player.sendMessage(`§7[§b#§7] §aSuccessfully Disabled Chat Display.`);
        system.run(() => player.runCommand(`playsound note.bell @s`));
    } else {
        player.sendMessage(`§7[§b#§7] §cInvalid action! Use: §3!chatdisplay set/remove <chatstyle>\n\nSymbols:\n{name} = player's username\n{rank} = rank\n{message} = message.`);
        system.run(() => player.runCommand('playsound random.break @s'));
    }
});

system.run(() => {
    try {
        const storedStates = world.getDynamicProperty(CHAT_CONFIG_STATES_KEY);
        if (storedStates) {
            main.chatConfig = JSON.parse(storedStates);
        } else {
            world.setDynamicProperty(CHAT_CONFIG_STATES_KEY, JSON.stringify(main.chatConfig));
        }
    } catch (error) {
        console.error(`Error parsing stored chat config states: ${error.message}`);
    }
});

function saveChatConfigStates() {
    world.setDynamicProperty(CHAT_CONFIG_STATES_KEY, JSON.stringify(main.chatConfig));
}

Command.register({
    name: "chatconfig",
    description: "",
    aliases: [],
    permission: (player) => player.hasTag(main.adminTag),
}, (data, args) => {
    const { player } = data;
    const action = args[0]?.toLowerCase();
    const moduleName = args[1]?.toLowerCase();
    const integerValue = args[2]?.toLowerCase();

    if (!action || !["enable", "disable", "list", "set"].includes(action)) {
        player.sendMessage(`§7[§b#§7] §cInvalid action! Use: §3!chatconfig enable/disable <chatConfigOption> or !chatconfig list or !chatconfig set <chatConfigOption> <integerValue>`);
        return;
    }

    if (action === "set" && isNaN(integerValue)) {
        player.sendMessage(`§7[§b#§7] §cInvalid integer value provided!`);
        return;
    }

    if (action === "list") {
        let moduleList = "§7[§b#§7] §aModule States:\n";
        let count = 1;
        for (const [key, state] of Object.entries(main.chatConfig)) {
            moduleList += `§7[§e${count}§7] §7[${typeof state == "boolean" ? state ? "§aENABLED" : "§cDISABLED" : state}§7] §e${key}\n`;
            count++;
        }
        player.sendMessage(moduleList);
        return;
    }

    const availableModules = Object.keys(main.chatConfig);
    if (!availableModules.map((key) => key.toLowerCase()).includes(moduleName)) {
        player.sendMessage(`§7[§b#§7] §cInvalid chat configuration option. Available: ${availableModules.join(", ")}`);
        return;
    }

    if (action === "enable") {
        const actualModuleName = availableModules.find((key) => key.toLowerCase() === moduleName);
        main.chatConfig[actualModuleName] = true;
        saveChatConfigStates();
        player.sendMessage(`§7[§b#§7] §aChat config §e${actualModuleName} §aenabled.`);
    } else if (action === "disable") {
        const actualModuleName = availableModules.find((key) => key.toLowerCase() === moduleName);
        main.chatConfig[actualModuleName] = false;
        saveChatConfigStates();
        player.sendMessage(`§7[§b#§7] §aChat config §e${actualModuleName} §cdisabled.`);
    } else if (action === "set") {
        const actualModuleName = availableModules.find((key) => key.toLowerCase() === moduleName);
        main.chatConfig[actualModuleName] = Number(args[2]);
        saveChatConfigStates();
        player.sendMessage(`§7[§b#§7] §aChat config §e${actualModuleName} §aset to ${args[2]}.`);
    }
});

system.runInterval(() => {
    world.getDimension("overworld").runCommand(`scoreboard players reset @a Sents`);
}, 6000);

world.beforeEvents.chatSend.subscribe((data) => {
    const player = data.sender;
    
    if (player.hasTag("isMuted")) {
        data.cancel = true;
        player.sendMessage(`§7[§c!§7] §cYou are muted and cannot send messages.`);
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }
    
    if (debugSticksHasDisabledChatModification === true) {
        return;
    }
    const chatDisplayEnabled = world.getDynamicProperty("chatDisplayEnabled");
    if (chatDisplayEnabled !== false && !data.message.startsWith(main.prefix)) {
        chat(data);
    }
});

export function ChatConfigurationPanel(player) {
    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aConfiguration")
        .body("Manage chat settings:");

    form.button(customFormUICodes.action.buttons.positions.main_only + "Chat Ranks", "textures/ui/icon_book_writable")
        .button(customFormUICodes.action.buttons.positions.main_only + "Chat Display", "textures/ui/icon_book_writable")
        .button(customFormUICodes.action.buttons.positions.main_only + "Chat Config", "textures/ui/icon_book_writable")
        .button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled) return;

        switch (response.selection) {
            case 0: ChatRanksPanel(player); break;
            case 1: ChatDisplayPanel(player); break;
            case 2: ChatConfigPanel(player); break;
            case 3: showModerationUI(player); break;
        }
    }).catch((error) => {
        console.error("Failed to show chat configuration panel:", error);
    });
}

// Rest of functions unchanged, just remove emoji-related code...
function ChatDisplayPanel(player) {
    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aChat Display")
        .body("Manage chat display settings:");

    form.button(customFormUICodes.action.buttons.positions.main_only + "§aSet Chat Format", "textures/ui/icon_book_writable")
        .button(customFormUICodes.action.buttons.positions.main_only + "§eDefault Chat Format", "textures/ui/minus")
        .button(customFormUICodes.action.buttons.positions.main_only + "§aEnable Chat Display", "textures/ui/realms_green_check.png")
        .button(customFormUICodes.action.buttons.positions.main_only + "§cDisable Chat Display", "textures/ui/redX1.png")
        .button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled) return;

        switch (response.selection) {
            case 0: 
                setChatFormatPanel(player);
                break;
            case 1: 
                removeChatFormat();
                player.sendMessage("§7[§b#§7] §aChat format reset to default.");
                break;
            case 2:
                world.setDynamicProperty("chatDisplayEnabled", true);
                player.sendMessage("§7[§b#§7] §aChat display enabled.");
                break;
            case 3:
                world.setDynamicProperty("chatDisplayEnabled", false);
                player.sendMessage("§7[§b#§7] §aChat display disabled.");
                break;
            case 4: ChatConfigurationPanel(player); break;
        }
    }).catch((error) => console.error("Failed to show chat display panel:", error));
}

function setChatFormatPanel(player) {
    const form = new ModalFormData()
        .title(customFormUICodes.modal.titles.formStyles.general + "§l§bBlueMods §7| §aSet Chat Format")
        .textField(
            "Enter the chat format:\n\nPlaceholders:\n{name} - Player's name\n{rank} - Player's rank\n{message} - Player's message\n\nExample: {rank} {name}: {message}",
            "{rank} {name}: {message}"
        );

    form.show(player).then((response) => {
        if (response.canceled) return;
        const format = response.formValues[0].trim();
        if (!format) {
            player.sendMessage("§7[§b#§7] §cChat format cannot be empty!");
            return;
        }
        world.setDynamicProperty("globalChatFormat", format);
        player.sendMessage(`§7[§b#§7] §aChat format set to: §e${format}`);
        system.run(() => player.runCommand("playsound random.levelup @s"));
    }).catch((error) => console.error("Failed to show set chat format panel:", error));
}

function ChatConfigPanel(player) {
    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aChat Config")
        .body("Manage chat config settings:");

    for (const [key, value] of Object.entries(main.chatConfig)) {
        const statusIcon = value ? "textures/ui/realms_green_check.png" : "textures/ui/redX1.png";
        form.button(customFormUICodes.action.buttons.positions.main_only + `§e${key}`, statusIcon);
    }
    
    form.button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled) return;
        
        if (response.selection === Object.keys(main.chatConfig).length) {
            ChatConfigurationPanel(player);
            return;
        }

        const selectedOption = Object.keys(main.chatConfig)[response.selection];
        main.chatConfig[selectedOption] = !main.chatConfig[selectedOption];
        saveChatConfigStates();

        player.sendMessage(`§7[§b#§7] §aToggled §e${selectedOption} to ${main.chatConfig[selectedOption] ? "Enabled" : "Disabled"}.`);
        system.run(() => player.runCommand("playsound note.bell @s"));
        ChatConfigPanel(player);
    }).catch((error) => console.error("Failed to show chat config panel:", error));
}

function ChatRanksPanel(player) {
    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aChat Ranks")
        .body("Manage chat ranks:")
    form.button(customFormUICodes.action.buttons.positions.main_only + "§aAdd Rank", "textures/ui/color_plus")
        .button(customFormUICodes.action.buttons.positions.main_only + "§cRemove Rank", "textures/ui/minus")
        .button(customFormUICodes.action.buttons.positions.main_only + "§eEdit Rank", "textures/ui/editIcon")
        .button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled) return;
        switch (response.selection) {
            case 0: AddRankPanel_SelectPlayerPanel(player); break;
            case 1: RemoveRankPanel(player); break;
            case 2: EditRankPanel(player); break;
            case 3: ChatConfigurationPanel(player); break;
        }
    }).catch((error) => console.error("Failed to show chat ranks panel:", error));
}

function AddRankPanel_SelectPlayerPanel(player) {
    const onlinePlayers = Array.from(world.getPlayers());
    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aSelect Player")
        .body("Choose a player to assign a rank:");

    onlinePlayers.forEach((p) => {
        form.button(customFormUICodes.action.buttons.positions.main_only + `§a${p.name}`, "textures/ui/icon_steve");
    });

    form.button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === onlinePlayers.length + 1) return;
        if (response.selection === onlinePlayers.length) {
            ChatRanksPanel(player);
            return;
        }

        const selectedPlayer = onlinePlayers[response.selection];
        AddRankPanel(player, selectedPlayer.name);
    }).catch((error) => console.error("Failed to show player selection panel:", error));
}

function AddRankPanel(player, targetPlayer) {
    const rankIcons = Object.entries(main.ranksIcon).map(([name]) => name);
    rankIcons.unshift("None");
    
    const form = new ModalFormData()
        .title(customFormUICodes.modal.titles.formStyles.general + "§l§bBlueMods §7| §aAdd Chat Rank")
        .textField("Enter the rank name:", "Example: Moderator")
        .textField(
            `Available Colors: \n(${Object.entries(main.colors).map(([name, code]) => `${code}${name}`).join("§f, ")})\n\n§rEnter the rank color:`, 
            "Enter Color Name: "
        )
        .dropdown("Select Rank Icon (Optional):", rankIcons);

    form.show(player).then((response) => {
        if (response.canceled) return;

        const rankName = response.formValues[0]?.trim();
        const rankColor = main.colors[response.formValues[1]?.trim()] || "";
        const iconIndex = response.formValues[2];
        const iconKey = rankIcons[iconIndex];
        const icon = iconKey !== "None" ? main.ranksIcon[iconKey] : "";

        if (!rankName) {
            player.sendMessage("§7[§b#§7] §cRank name cannot be empty!");
            return;
        }

        system.run(() => player.runCommand(`tag "${targetPlayer}" add "rank:${icon} ${rankColor}${rankName}"`));
        player.sendMessage(`§7[§b#§7] §aAssigned rank ${icon} §r${rankColor}${rankName} §ato §e${targetPlayer}§a.`);
        system.run(() => player.runCommand("playsound random.levelup @s"));
    }).catch((error) => console.error("Failed to show add rank panel:", error));
}

function RemoveRankPanel(player) {
    const onlinePlayers = Array.from(world.getPlayers());
    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aSelect Player")
        .body("Choose a player to remove their rank:");

    onlinePlayers.forEach((p) => {
        form.button(customFormUICodes.action.buttons.positions.main_only + `§a${p.name}`, "textures/ui/icon_steve");
    });

    form.button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === onlinePlayers.length + 1) return;
        if (response.selection === onlinePlayers.length) {
            ChatRanksPanel(player);
            return;
        }

        const selectedPlayer = onlinePlayers[response.selection];
        RemoveRankListPanel(player, selectedPlayer);
    }).catch((error) => console.error("Failed to show player selection panel:", error));
}

function RemoveRankListPanel(player, targetPlayer) {
    const rankTags = targetPlayer.getTags().filter(tag => tag.startsWith("rank:"));

    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + `§l§bBlueMods §7| §a${targetPlayer.name}'s Ranks`)
        .body("Select a rank to remove:");

    rankTags.forEach(rank => {
        const rankName = rank.replace("rank:", "");
        form.button(customFormUICodes.action.buttons.positions.main_only + `§c${rankName}`, "textures/items/name_tag");
    });

    if(rankTags.length === 0) {
        form.body(`${targetPlayer.name} has no assigned ranks.`);
    }

    form.button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === rankTags.length + 1) return;
        if (response.selection === rankTags.length) {
            RemoveRankPanel(player);
            return;
        }

        const selectedRank = rankTags[response.selection];
        ConfirmRemoveRankPanel(player, targetPlayer, selectedRank);
    }).catch((error) => console.error("Failed to show rank selection panel:", error));
}

function ConfirmRemoveRankPanel(player, targetPlayer, selectedRank) {
    const rankName = selectedRank.replace("rank:", "");

    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + `§l§cConfirm Removal`)
        .body(`Are you sure you want to remove the rank §r${rankName} §cfrom §e${targetPlayer.name}§c?`)
        .button(customFormUICodes.action.buttons.positions.main_only + "§aConfirm", "textures/ui/realms_green_check.png")
        .button(customFormUICodes.action.buttons.positions.main_only + "§cCancel", "textures/ui/redX1.png"); 

    form.show(player).then((response) => {
        if (response.canceled) return;

        if (response.selection === 0) {
            targetPlayer.removeTag(selectedRank);
            player.sendMessage(`§7[§b#§7] §cRemoved rank: §r${rankName} §cfrom §e${targetPlayer.name}§c.`);
        } else {
            RemoveRankListPanel(player, targetPlayer);
        }
    }).catch((error) => console.error("Failed to show confirmation panel:", error));
}

function EditRankPanel(player) {
    const onlinePlayers = Array.from(world.getPlayers());
    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aEdit Player Rank")
        .body("Choose a player to edit their rank:");

    onlinePlayers.forEach((p) => {
        form.button(customFormUICodes.action.buttons.positions.main_only + "§a" + p.name, "textures/ui/icon_steve");
    });

    form.button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === onlinePlayers.length + 1) return;
        if (response.selection === onlinePlayers.length) {
            ChatRanksPanel(player);
            return;
        }

        const selectedPlayer = onlinePlayers[response.selection];
        EditRankListPanel(player, selectedPlayer);
    }).catch((error) => console.error("Failed to show edit rank panel:", error));
}

function EditRankListPanel(player, targetPlayer) {
    const rankTags = targetPlayer.getTags().filter(tag => tag.startsWith("rank:"));

    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + `§l§bBlueMods §7| §a${targetPlayer.name}'s Ranks`)
        .body("Select a rank to edit:");

    rankTags.forEach(rank => {
        const rankName = rank.replace("rank:", "");
        form.button(customFormUICodes.action.buttons.positions.main_only + `§c${rankName}`, "textures/items/name_tag");
    });

    if(rankTags.length === 0) {
        form.body(`${targetPlayer.name} has no assigned ranks.`);
    }

    form.button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === rankTags.length + 1) return;
        if (response.selection === rankTags.length) {
            EditRankPanel(player);
            return;
        }

        const selectedRank = rankTags[response.selection];
        EditRankDetailsPanel(player, targetPlayer, selectedRank);
    }).catch((error) => console.error("Failed to show rank selection panel:", error));
}

function EditRankDetailsPanel(player, targetPlayer, selectedRank) {
    const currentRankName = selectedRank.replace("rank:", "");
    const rankIcons = Object.entries(main.ranksIcon).map(([name]) => name);
    rankIcons.unshift("None");
    
    const form = new ModalFormData()
        .title(customFormUICodes.modal.titles.formStyles.general + `§l§aEdit Rank: ${currentRankName}`)
        .textField("Enter new rank name:", "Example: Admin")
        .textField(
            `Available Colors: (${Object.entries(main.colors).map(([name, code]) => `${code}${name}`).join(", ")})\n§rEnter the rank color:`, 
            "Enter the Color Name: "
        )
        .dropdown("Select Rank Icon (Optional):", rankIcons);

    form.show(player).then((response) => {
        if (response.canceled) return;

        const newName = response.formValues[0]?.trim();
        const rankColor = main.colors[response.formValues[1]?.trim()] || "";
        const iconIndex = response.formValues[2];
        const iconKey = rankIcons[iconIndex];
        const icon = iconKey !== "None" ? main.ranksIcon[iconKey] : "";

        if (!newName) {
            player.sendMessage("§7[§b#§7] §cRank name cannot be empty!");
            return;
        }

        targetPlayer.removeTag(selectedRank);
        targetPlayer.addTag(`rank:${icon}${rankColor}${newName}`);
        player.sendMessage(`§7[§b#§7] §aUpdated rank to: ${icon}§r${rankColor}${newName} §afor §e${targetPlayer.name}§a.`);
        system.run(() => player.runCommand("playsound random.levelup @s"));
    }).catch((error) => console.error("Failed to show edit rank details panel:", error));
}