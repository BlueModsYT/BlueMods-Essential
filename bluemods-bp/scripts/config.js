//░███░░██░░██░░█░████░██░░██░░████░░████░░░███░
//░█░░█░█░░░░█░░█░█░░░░██░░██░█░░░█░░█░░░█░█░░█░
//░███░░█░░░░█░░█░███░░██░░██░█░░░░█░█░░░█░██░░░
//░█░░█░█░░░░█░░█░█░░░░█░██░█░█░░░░█░█░░░█░░░█░░
//░█░░█░█░░█░█░░█░█░░█░█░██░█░█░░░█░░█░░░█░█░░█░
//░███░░████░███░░████░█░█░░█░░███░░░████░░███░░
// https://dsc.gg/bluemods

export const main = {
    prefix: "!", // Main Prefix
    adminTag: "admin",
    notifyTag: "notify",
    developer: "§b@bluemods.lol §7| §3https://dsc.gg/bluemods",
    bmversion: "§gBeta-v1.0.0",
    mcversion: "§g1.26.30 §7- §g1.26.31",
    bmdescription: "§3An all-in-one Minecraft Bedrock addon designed to provide essential for both Realms and dedicated servers.",
    player: "§7<§eplayer§7>",
    reason: "§7[§areason§7]",
    valuedata: "§7<§evalue§7> [§edata§7]",
    addremove: "§7<§aadd§7/§cremove§7>",
    enabledisable: "§7<§aenable§7/§cdisable§7>",
    enabledCommandsKey: "enabledCommands",
    combatTimer: 11, // Combat Log Timer - Set as 11 because it will turn into 10
    pearlCooldown: 10, // Default Cooldown
    pearlMinCooldown: 3, // Limit
    goldenAppleCooldown: 5, // Default Cooldown
    goldenAppleMinCooldown: 3, // Limit
    enchantedAppleCooldown: 5, // Default Cooldown 
    enchantedAppleMinCooldown: 3, // Limit
    teleportCooldown: 5, // Homes / Tpa / Rtp
    creators: [
        "BlueShadow",
        "Trokkk",
        "MP09",
        "8Crafter",
        "Mehmet303j"
    ],
    beta: [],
    ranks: [
        { name: "BlueModsYT", tag: "§bCreator", icon: "\uF109" }
    ],
    colors: {
        black: "§0",
        dark_blue: "§1",
        dark_green: "§2",
        dark_aqua: "§3",
        dark_red: "§4",
        dark_purple: "§5",
        gold: "§6",
        gray: "§7",
        dark_gray: "§8",
        blue: "§9",
        green: "§a",
        aqua: "§b",
        red: "§c",
        light_purple: "§d",
        yellow: "§e",
        white: "§f"
    },
    chatConfig: { // Chat Config (Spam Cooldowns, etc.)
        "spamCooldown": 5000,
        "allowDuplicateMessages": false,
        "allowBadWords": false,
        "allowSpam": false
    },
    enabledCommands: {
        // General Commands
        "help": true,
        // "about": true, - not disabled
        "home": false,
        "ping": true,
        "rtp": false,
        "tpa": true,
        "echest": false,
        "compass": false,
        "back": false,
        // Gamemodes
        "gma": true,
        "gmc": true,
        "gms": true,
        "gmsp": true,
        "vanish": true,
        // Staff Commands
        "ban": true,
        "kick": true,
        "cmdsf": true,
        "mute": true,
        "lagclear": true,
        "give": true,
        "troll": true,
        "welcome": true,
        "banitem": true,
        "clearchat": true,
        "gapple": false,
        "ecwipe": true,
        "ecsee": true,
        "invsee": true,
        "invwipe": true,
        "pearl": true,
        "chatdisplay": true,
        "rank": true,
        "warp": true,
        // Operator's Only
        "notify": true,
        "op": true
    },
    Modules: {
        "receiveCompassOnJoin": false,
        "removeDupeBundles": true,
        "removeDupeCrafter": true,
        "removeDupeStackedInventory": true,
        "antiSpamClicks": false,
        "inCombatLogging": false,
        "enchantmentCheck": false,
        "loredItemCheck": true,
        "dangerItemCheck": true,
        "operatorItemCheck": true,
        "eggItemCheck": true,
        "unknownItemCheck": true,
        "nameSpoofCheck": true,
        "nbtItemCheck": true,
        "isAgentMob": true,
        "isCommandBlockMinecart": true,
        "isNPCMob": false,
        "isCreativeMode": false
    },
    memberCategories: [ // Help Commands
        {
            name: "command.general.category",
            commands: [
                { text: `  §7- §a!rtp §7- §3`, description: "command.rtp.description" },
                { text: `  §7- §a!help §7- §3`, description: "command.help.description" },
                { text: `  §7- §a!ping §7- §3`, description: "command.ping.description" },
                { text: `  §7- §a!about §7- §3`, description: "command.about.description" },
                { text: `  §7- §a!warp §7- §3`, description: "command.warp.description" }
            ]
        },
        {
            name: "command.tpa.category",
            commands: [
                { text: `  §7- §a!tpa §asend §7<§eplayer§7> §7- §3`, description: "command.tpasend.description" },
                { text: `  §7- §a!tpa §aaccept §7- §3`, description: "command.tpaaccept.description" },
                { text: `  §7- §a!tpa §cdecline §7- §3`, description: "command.tpadecline.description" },
                { text: `  §7- §a!tpa §ccancel §7- §3`, description: "command.tpacancel.description" },
                { text: `  §7- §a!tpa §dblock §7<§eplayer§7> §7- §3`, description: "command.tpablock.description" },
                { text: `  §7- §a!tpa §dunblock §7<§eplayer§7> §7- §3`, description: "command.tpaunblock.description" }
            ]
        },
        {
            name: "command.home.category",
            commands: [
                { text: `  §7- §a!home tp §7<§ehome_name§7> §7- §3`, description: "command.home.description" },
                { text: `  §7- §a!home §7<§eset§7/§cremove§7> §7<§ehome_name§7> §7- §3`, description: "command.homeset.description" },
                { text: `  §7- §a!home list §7- §3`, description: "command.homelist.description" }
            ]
        }
    ],
    adminCategories: [
        {
            name: "command.general.category",
            commands: [
                { text: `  §7- §a!rtp §7- §3`, description: "command.rtp.description" },
                { text: `  §7- §a!help §7- §3`, description: "command.help.description" },
                { text: `  §7- §a!ping §7- §3`, description: "command.ping.description" },
                { text: `  §7- §a!about §7- §3`, description: "command.about.description" },
                { text: `  §7- §a!spawn §7- §3`, description: "command.spawn.description" },
                { text: `  §7- §a!warp §7- §3`, description: "command.warp.description" }
            ]
        },
        {
            name: "command.tpa.category",
            commands: [
                { text: `  §7- §a!tpa §asend §7<§eplayer§7> §7- §3`, description: "command.tpasend.description" },
                { text: `  §7- §a!tpa §aaccept §7- §3`, description: "command.tpaaccept.description" },
                { text: `  §7- §a!tpa §cdecline §7- §3`, description: "command.tpadecline.description" },
                { text: `  §7- §a!tpa §ccancel §7- §3`, description: "command.tpacancel.description" },
                { text: `  §7- §a!tpa §dblock §7<§eplayer§7> §7- §3`, description: "command.tpablock.description" },
                { text: `  §7- §a!tpa §dunblock §7<§eplayer§7> §7- §3`, description: "command.tpaunblock.description" }
            ]
        },
        {
            name: "command.home.category",
            commands: [
                { text: `  §7- §a!home tp §7<§ehome_name§7> §7- §3`, description: "command.home.description" },
                { text: `  §7- §a!home §7<§eset§7/§cremove§7> §7<§ehome_name§7> §7- §3`, description: "command.homeset.description" },
                { text: `  §7- §a!home list §7- §3`, description: "command.homelist.description" },
                { text: `  §7- §a!spawn §7- §3`, description: "command.spawn.description" },
                { text: `  §7- §a!rspawn §7- §3`, description: "command.rspawn.description" },
                { text: `  §7- §a!setspawn §7- §3`, description: "command.setspawn.description" }
            ]
        },
        {
            name: "command.gamemode.category",
            commands: [
                { text: `  §7- §a!gma §7<§eplayer§7> §7- §3`, description: "command.gmc.description" },
                { text: `  §7- §a!gmc §7<§eplayer§7> §7- §3`, description: "command.setspawn.description" },
                { text: `  §7- §a!gms §7<§eplayer§7> §7- §3`, description: "command.setspawn.description" },
                { text: `  §7- §a!gmsp §7<§eplayer§7> §7- §3`, description: "command.gmsp.description" },
                { text: `  §7- §a!vanish §7<§eplayer§7> §7- §3`, description: "command.vanish.description" }
            ]
        },
        {
            name: "command.gamemode.category",
            commands: [
                { text: `  §7- §a!ban §aadd §7[§aduration§7] §7<§eplayer§7> <§areason§7> §7- §3`, description: "command.kick.description" },
                { text: `  §7- §a!ban §cremove §7<§eplayer§7> §7- §3`, description: "command.kick.description" },
                { text: `  §7- §a!kick §7<§eplayer§7> §7[§areason§7] §7- §3`, description: "command.kick.description" },
                { text: `  §7- §a!cmdsf §7<§aenable§7/§cdisable§7> §7- §3`, description: "command.cmdsf.description" },
                { text: `  §7- §a!mute §7<§aadd§7/§cremove§7> §7<§eplayer§7> §7- §3`, description: "command.mute.description" },
                { text: `  §7- §a!mute list §7- §3`, description: "command.mutelist.description" },
                { text: `  §7- §a!lagclear §7<§adefault§7/§amobs§7/§aall§7> §7- §3`, description: "command.lagclear.description" },
                { text: `  §7- §a!give §7<§aitem§7> §7<§evalue§7> [§edata§7] §7- §3`, description: "command.give.description" },
                { text: `  §7- §a!troll §7<§dtroll§7> §7<§eplayer§7> §7- §3`, description: "command.troll.description" },
                { text: `  §7- §a!banitem §7<§aadd§7/§cremove§7> §7<§aitem§7> §7- §3`, description: "command.banitem.description" },
                { text: `  §7- §a!banitem list §7- §3`, description: "command.banitemlist.description" },
                { text: `  §7- §a!clearchat §7- §3`, description: "command.clearchat.description" },
                { text: `  §7- §e!gapple §7- §3`, description: "command.gapple.description" },
                { text: `  §7- §a!ecwipe §7<§eplayer§7> §7- §3`, description: "command.ecwipe.description" },
                { text: `  §7- §e!ecsee §7<§eplayer§7> §7- §3`, description: "command.ecsee.description" },
                { text: `  §7- §a!invsee §7<§eplayer§7> §7- §3`, description: "command.invsee.description" },
                { text: `  §7- §a!invwipe §7<§eplayer§7> §7- §3`, description: "command.invwipe.description" },
                { text: `  §7- §a!pearl §7<§gduration§7> §7- §3`, description: "command.pearl.description" },
                { text: `  §7- §a!rank §7<§aadd§7/§cremove§7> §7<§arank§7> §7[§gcolor§7] §7<§eplayer§7> §7- §3`, description: "command.rank.description" },
                { text: `  §7- §a!floatingtext §7<§atext§7> §7[§gx, y, z§7] - §3`, description: "command.floatingtext.description" }
            ]
        },
        {
            name: "command.operator.category",
            commands: [
                { text: `  §7- §a!op §7<§aadd§7/§cremove§7> §7<§eplayer§7> §7- §3`, description: "command.op.description" },
                { text: `  §7- §a!op list §7- §3`, description: "command.oplist.description" },
                { text: `  §7- §a!notify §7<§aadd§7/§cremove§7> §7<§eplayer§7> §7- §3`, description: "command.notify.description" },
                { text: `  §7- §a!notify list §7- §3`, description: "command.notifylist.description" }
            ]
        },
        {
            name: "command.modules.category",
            commands: [
                { text: `  §7- §a!chatconfig §7<§aenable§7/§cdisable§7> §7<§6module§7> §7- §3`, description: "command.chatconfig.description" },
                { text: `  §7- §a!chatconfig §7<§eset§7> §7<§6module§7> §7<§6integerValue§7> §7- §3`, description: "command.chatconfigset.description" },
                { text: `  §7- §a!chatconfig list §7- §3`, description: "command.chatconfiglist.description" },
                { text: `  §7- §a!cmdtoggle §7<§aenable§7/§cdisable§7> <§acommand§7> §7- §3`, description: "command.cmdtoggle.description" },
                { text: `  §7- §a!cmdtoggle list §7- §3`, description: "command.cmdtogglelist.description" },
                { text: `  §7- §a!chatdisplay §7<§eset§7/§cremove§7> §7<§achatstyle§7> §7- §3`, description: "command.chatdisplayset.description" },
                { text: `  §7- §a!chatdisplay §7<§aenable§7/§cdisable§7> §7- §3`, description: "command.chatdisplay.description" },
                { text: `  §7- §a!welcome §7<§ajoin§7/§cleave§7> §7<§eset§7/§cremove§7> §7[§atext§7] §7- §3`, description: "command.welcome.description" }
            ]
        }
    ]
};

export default main;