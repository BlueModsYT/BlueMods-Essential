import { world, system } from "@minecraft/server";
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

const teleportingPlayers = new Map();

export function showHomeUI(player) {
    const homeDataJson = player.getDynamicProperty("playerHome");
    const homes = homeDataJson ? JSON.parse(homeDataJson) : {};

    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aHomes")
        .body("Choose an option:");

    for (const homeName in homes) {
        form.button(customFormUICodes.action.buttons.positions.main_only + `§a${homeName}`, "textures/items/bed_green");
    }

    form.button(customFormUICodes.action.buttons.positions.main_only + "§eSet Home", "textures/items/bed_yellow")
        .button(customFormUICodes.action.buttons.positions.main_only + "§cRemove Home", "textures/items/bed_red")
        .button(customFormUICodes.action.buttons.positions.main_only + "§bList Homes", "textures/items/bed_blue")
        .button(customFormUICodes.action.buttons.positions.title_bar_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled) return;

        const selectedIndex = response.selection;

        if (selectedIndex < Object.keys(homes).length) {
            const homeName = Object.keys(homes)[selectedIndex];
            teleportHome(player, homeName);
        } else {
            switch (selectedIndex - Object.keys(homes).length) {
                case 0:
                    showSetHomeForm(player);
                    break;
                case 1:
                    showRemoveHomeForm(player);
                    break;
                case 2:
                    listHomes(player);
                    break;
                case 3:
                    showCompassUI(player);
                    break;
                case 4:
                    break;
            }
        }
    }).catch((error) => {
        console.error("Failed to show home form:", error);
        player.sendMessage("§7[§c-§7] §cAn error occurred while showing the home menu.");
    });
}

function showSetHomeForm(player) {
    const form = new ModalFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aSet Home")
        .textField("Enter a name for your home:", "Home Name");

    form.show(player).then((response) => {
        if (response.canceled) {
            player.sendMessage("§7[§b#§7] §cSet home canceled.");
            return;
        }

        const [homeName] = response.formValues;
        if (!homeName) {
            player.sendMessage("§7[§c-§7] §cPlease specify a home name.");
            return;
        }

        setHome(player, homeName);
    }).catch((error) => {
        console.error("Failed to show set home form:", error);
        player.sendMessage("§7[§c-§7] §cAn error occurred while setting your home.");
    });
}

function showRemoveHomeForm(player) {
    const homeDataJson = player.getDynamicProperty("playerHome");
    const homes = homeDataJson ? JSON.parse(homeDataJson) : {};

    if (Object.keys(homes).length === 0) {
        player.sendMessage("§7[§c-§7] §cYou don't have any homes to remove.");
        return;
    }

    const form = new ModalFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aRemove Home")
        .dropdown("Select a home to remove:", Object.keys(homes));

    form.show(player).then((response) => {
        if (response.canceled) {
            player.sendMessage("§7[§b#§7] §cRemove home canceled.");
            return;
        }

        const [selectedIndex] = response.formValues;
        const homeName = Object.keys(homes)[selectedIndex];

        removeHome(player, homeName);
    }).catch((error) => {
        console.error("Failed to show remove home form:", error);
        player.sendMessage("§7[§c-§7] §cAn error occurred while removing your home.");
    });
}

function setHome(player, homeName) {
    const homeDataJson = player.getDynamicProperty("playerHome");
    const homes = homeDataJson ? JSON.parse(homeDataJson) : {};

    homes[homeName] = {
        location: {
            x: player.location.x,
            y: player.location.y,
            z: player.location.z
        },
        dimension: player.dimension.id
    };

    player.setDynamicProperty("playerHome", JSON.stringify(homes));
    player.sendMessage(`§7[§a+§7] §aHome §e${homeName} §aset successfully!`);
    system.run(() => player.runCommand('playsound note.bell @s'));
}

function removeHome(player, homeName) {
    const homeDataJson = player.getDynamicProperty("playerHome");
    const homes = homeDataJson ? JSON.parse(homeDataJson) : {};

    if (!homes[homeName]) {
        player.sendMessage(`§7[§c-§7] §cHome §e${homeName} §cdoes not exist.`);
        return;
    }

    delete homes[homeName];
    player.setDynamicProperty("playerHome", JSON.stringify(homes));
    player.sendMessage(`§7[§a+§7] §cHome §e${homeName} §cremoved successfully!`);
    system.run(() => player.runCommand('playsound note.bell @s'));
}

function listHomes(player) {
    const homeDataJson = player.getDynamicProperty("playerHome");
    const homes = homeDataJson ? JSON.parse(homeDataJson) : {};

    if (Object.keys(homes).length === 0) {
        player.sendMessage("§7[§c-§7] §cYou don't have any homes set.");
        return;
    }

    const homeList = Object.entries(homes).map(([name, loc]) => {
        return `§e${name} §7- §f${loc.x}, ${loc.y}, ${loc.z} §7(${loc.dimension})`;
    }).join("\n");

    player.sendMessage(`§7[§a+§7] §aYour Homes:\n${homeList}`);
}

function teleportHome(player, homeName) {
    const playerId = player.id;
    const homeDataJson = player.getDynamicProperty("playerHome");
    const homes = homeDataJson ? JSON.parse(homeDataJson) : {};

    if (!homes[homeName]) {
        player.sendMessage(`§7[§c-§7] §cHome §e${homeName} §cdoes not exist.`);
        return;
    }

    if (player.hasTag("isCombat")) {
        player.sendMessage("§7[§c!§7] §cYou cannot teleport to your home while in combat!");
        system.run(() => player.runCommand('playsound random.break @s'));
        return;
    }

    if (teleportingPlayers.has(playerId)) {
        player.sendMessage("§7[§c-§7] §cYou are already teleporting!");
        return;
    }

    const homeLocation = homes[homeName];
    const initialPosition = { x: player.location.x, y: player.location.y, z: player.location.z };

    teleportingPlayers.set(playerId, {
        initialPosition,
        countdown: main.teleportCooldown,
        homeLocation,
        homeName
    });

    player.sendMessage(`§7[§a!§7] §aTeleporting to §e${homeName} §ain §e${main.teleportCooldown} seconds§a. Don't move!`);
    system.run(() => player.runCommand('playsound random.orb @s'));

    const countdownInterval = system.runInterval(() => {
        const playerData = teleportingPlayers.get(playerId);
        
        if (!playerData || !player) {
            system.clearRun(countdownInterval);
            teleportingPlayers.delete(playerId);
            return;
        }

        if (player.hasTag("isCombat")) {
            player.sendMessage("§7[§c!§7] §cTeleport cancelled - you entered combat!");
            system.run(() => player.runCommand('playsound random.break @s'));
            system.clearRun(countdownInterval);
            teleportingPlayers.delete(playerId);
            return;
        }

        const currentPosition = { x: player.location.x, y: player.location.y, z: player.location.z };

        if (
            currentPosition.x !== initialPosition.x ||
            currentPosition.y !== initialPosition.y ||
            currentPosition.z !== initialPosition.z
        ) {
            player.sendMessage("§7[§c-§7] §cTeleport cancelled - you moved!");
            system.run(() => player.runCommand('playsound random.break @s'));
            system.clearRun(countdownInterval);
            teleportingPlayers.delete(playerId);
            return;
        }

        playerData.countdown--;

        if (playerData.countdown > 0) {
            player.sendMessage(`§7[§a!§7] §aTeleporting in §e${playerData.countdown} §aseconds...`);
            system.run(() => player.runCommand('playsound note.hat @s'));
        } else {
            system.clearRun(countdownInterval);
            teleportingPlayers.delete(playerId);

            try {
                const x = homeLocation.location ? homeLocation.location.x : homeLocation.x;
                const y = homeLocation.location ? homeLocation.location.y : homeLocation.y;
                const z = homeLocation.location ? homeLocation.location.z : homeLocation.z;
                const dim = homeLocation.dimension || "minecraft:overworld";

                player.teleport(
                    { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) },
                    { dimension: world.getDimension(dim) }
                );
                player.sendMessage(`§7[§a+§7] §aTeleported to §e${homeName}§a!`);
                system.run(() => player.runCommand('playsound mob.endermen.portal @s'));
            } catch (e) {
                player.sendMessage("§7[§c-§7] §cFailed to teleport. Dimension unavailable.");
            }
        }
    }, 20);
}

export function teleportHomeFromCommand(player, homeName) {
    if (!homeName) {
        player.sendMessage('§7[§c-§7] §cPlease specify the home name. §3!home tp <homeName>');
        return;
    }
    teleportHome(player, homeName);
}

export function setHomeFromCommand(player, homeName) {
    if (!homeName) {
        player.sendMessage('§7[§c-§7] §cPlease specify a home name. §3!home set <homeName>');
        return;
    }
    setHome(player, homeName);
}

export function removeHomeFromCommand(player, homeName) {
    if (!homeName) {
        player.sendMessage('§7[§c-§7] §cPlease specify a home name. §3!home remove <homeName>');
        return;
    }
    removeHome(player, homeName);
}

export function listHomesFromCommand(player) {
    listHomes(player);
}