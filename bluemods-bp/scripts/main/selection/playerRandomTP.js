import { world, system } from "@minecraft/server";
import main from "../../config.js";

//░███░░██░░██░░█░████░██░░██░░████░░████░░░███░
//░█░░█░█░░░░█░░█░█░░░░██░░██░█░░░█░░█░░░█░█░░█░
//░███░░█░░░░█░░█░███░░██░░██░█░░░░█░█░░░█░██░░░
//░█░░█░█░░░░█░░█░█░░░░█░██░█░█░░░░█░█░░░█░░░█░░
//░█░░█░█░░█░█░░█░█░░█░█░██░█░█░░░█░░█░░░█░█░░█░
//░███░░████░███░░████░█░█░░█░░███░░░████░░███░░
// https://dsc.gg/bluemods

const teleportingPlayers = new Map();
const TELEPORT_COUNTDOWN = 5;

export function showRandomTPUI(player) {
    const { id } = player;

    if (player.hasTag("isCombat")) {
        player.sendMessage("§7[§c!§7] §cYou cannot use random teleport while in combat!");
        system.run(() => player.runCommand("playsound random.break @s"));
        return;
    }

    if (teleportingPlayers.has(id)) {
        player.sendMessage('§7[§c-§7] §cYou are already in the process of teleporting. Please wait.');
        return;
    }

    const initialPosition = { x: player.location.x, y: player.location.y, z: player.location.z };
    player.sendMessage('§7[§a/§7] §aRandom teleporting in §e5 seconds§a. Do not move!');

    teleportingPlayers.set(id, { initialPosition, countdown: TELEPORT_COUNTDOWN });

    const countdownInterval = system.runInterval(() => {
        const playerData = teleportingPlayers.get(id);

        if (!playerData || !player) {
            system.clearRun(countdownInterval);
            teleportingPlayers.delete(id);
            return;
        }

        if (player.hasTag("isCombat")) {
            player.sendMessage("§7[§c!§7] §cTeleport cancelled - you entered combat!");
            system.run(() => player.runCommand('playsound random.break @s'));
            system.clearRun(countdownInterval);
            teleportingPlayers.delete(id);
            return;
        }

        const { countdown, initialPosition } = playerData;
        const currentPosition = { x: player.location.x, y: player.location.y, z: player.location.z };

        if (
            currentPosition.x !== initialPosition.x ||
            currentPosition.y !== initialPosition.y ||
            currentPosition.z !== initialPosition.z
        ) {
            player.sendMessage('§7[§c-§7] §cTeleportation canceled because you moved.');
            system.run(() => player.runCommand('playsound random.break @s'));
            teleportingPlayers.delete(id);
            system.clearRun(countdownInterval);
            return;
        }

        playerData.countdown -= 1;

        if (playerData.countdown > 0) {
            player.sendMessage(`§7[§a/§7] §aRandom teleporting in §e${playerData.countdown} seconds§a...`);
            system.run(() => player.runCommand('playsound random.orb @s'));
        } else {
            system.clearRun(countdownInterval);
            system.run(() => player.runCommand(`effect @s resistance 25 255 true`));

            system.run(() => {
                try {
                    player.runCommand(`spreadplayers ~ ~ 500 1000 @s`);
                    player.sendMessage('§7[§a/§7] §aYou have been randomly teleported.');
                    player.runCommand('playsound random.levelup @s');
                } catch (error) {
                    player.sendMessage('§7[§c-§7] §cError: Unable to teleport. Please try again.');
                    console.error(`Teleport error: ${error.message}`);
                }
            });

            teleportingPlayers.delete(id);
        }
    }, 20);
}