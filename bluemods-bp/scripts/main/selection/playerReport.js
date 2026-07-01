import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { showCompassUI } from "../playerCompass.js";
import { showModerationUI } from "../playerModeration.js";
import { customFormUICodes } from "../../handler/customFormUICodes.js";

//░███░░██░░██░░█░████░██░░██░░████░░████░░░███░
//░█░░█░█░░░░█░░█░█░░░░██░░██░█░░░█░░█░░░█░█░░█░
//░███░░█░░░░█░░█░███░░██░░██░█░░░░█░█░░░█░██░░░
//░█░░█░█░░░░█░░█░█░░░░█░██░█░█░░░░█░█░░░█░░░█░░
//░█░░█░█░░█░█░░█░█░░█░█░██░█░█░░░█░░█░░░█░█░░█░
//░███░░████░███░░████░█░█░░█░░███░░░████░░███░░
// https://dsc.gg/bluemods

const REPORTS_KEY = "reports";
const reportCooldownKey = "reportCooldowns";
const maxPerPage = 10;
const reportCooldown = 60000;
const maxActiveReports = 3;

function getCooldowns() {
    const data = world.getDynamicProperty(reportCooldownKey);
    return data ? JSON.parse(data) : {};
}

function saveCooldowns(cooldowns) {
    world.setDynamicProperty(reportCooldownKey, JSON.stringify(cooldowns));
}

function isOnCooldown(playerName) {
    const cooldowns = getCooldowns();
    return cooldowns[playerName] && cooldowns[playerName] > Date.now();
}

function setCooldown(playerName) {
    const cooldowns = getCooldowns();
    cooldowns[playerName] = Date.now() + reportCooldown;
    saveCooldowns(cooldowns);
}

function removeCooldown(playerName) {
    const cooldowns = getCooldowns();
    delete cooldowns[playerName];
    saveCooldowns(cooldowns);
}

function getCooldownRemaining(playerName) {
    const cooldowns = getCooldowns();
    if (!cooldowns[playerName]) return 0;
    return Math.ceil((cooldowns[playerName] - Date.now()) / 1000);
}

function getActiveReportsByUser(playerName) {
    const reports = getAllReports();
    return reports.filter(r => r.reporter.toLowerCase() === playerName.toLowerCase() && !r.resolved);
}

function generateReportId() {
    return `report-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function addReport(type, reporter, reportedPlayerName, details) {
    let reports = getAllReports();
    const newReport = {
        id: generateReportId(),
        type,
        reporter,
        reportedPlayerName,
        details,
        resolved: false,
        timestamp: Date.now(),
        date: new Date().toLocaleString()
    };

    reports.unshift(newReport);
    world.setDynamicProperty(REPORTS_KEY, JSON.stringify(reports));
}

function getAllReports() {
    const storedReports = world.getDynamicProperty(REPORTS_KEY);
    return storedReports ? JSON.parse(storedReports) : [];
}

function resolveReport(reportId) {
    const reports = getAllReports();
    const updatedReports = reports.map(r => {
        if (r.id === reportId) {
            return { ...r, resolved: true };
        }
        return r;
    });
    world.setDynamicProperty(REPORTS_KEY, JSON.stringify(updatedReports));
    
    const report = reports.find(r => r.id === reportId);
    if (report) {
        removeCooldown(report.reporter);
    }
}

function deleteReport(reportId) {
    const reports = getAllReports();
    const report = reports.find(r => r.id === reportId);
    const updatedReports = reports.filter(r => r.id !== reportId);
    world.setDynamicProperty(REPORTS_KEY, JSON.stringify(updatedReports));
    
    if (report) {
        removeCooldown(report.reporter);
    }
}

export function showReportUI(player) {
    const activeReports = getActiveReportsByUser(player.name);
    if (activeReports.length >= maxActiveReports) {
        player.sendMessage(`§7[§c-§7] §cYou have reached the maximum of §e${maxActiveReports} §cactive reports. Wait for an admin to resolve your existing reports.`);
        return;
    }

    if (isOnCooldown(player.name)) {
        const remaining = getCooldownRemaining(player.name);
        player.sendMessage(`§7[§c-§7] §cPlease wait §e${remaining}s §cbefore submitting another report.`);
        return;
    }

    const onlinePlayers = world.getPlayers().map(p => p.name);

    const form = new ModalFormData()
        .title(customFormUICodes.modal.titles.formStyles.general + "§l§bBlueMods §7| §eReport User")
        .dropdown("Select a Player to Report:", onlinePlayers.length > 0 ? onlinePlayers : ["No players online"])
        .textField("Or Enter Player Name:", "Type the player's name...")
        .dropdown("Select Report Type:", ["Advertisement", "Cheating", "Harassment", "Spamming", "Other"])
        .textField("Provide Details:", "Explain the issue...");

    form.show(player).then((response) => {
        if (response.canceled) return;

        const selectedPlayerIndex = response.formValues[0];
        const manualPlayerName = response.formValues[1].trim();
        const reportType = ["Advertisement", "Cheating", "Harassment", "Spamming", "Other"][response.formValues[2]];
        const reportDetails = response.formValues[3].trim();

        const reportedPlayerName = manualPlayerName || (onlinePlayers.length > 0 ? onlinePlayers[selectedPlayerIndex] : "");

        if (!reportedPlayerName) {
            player.sendMessage("§cPlease select or enter a player name.");
            return;
        }

        if (reportedPlayerName.toLowerCase() === player.name.toLowerCase()) {
            player.sendMessage("§cYou cannot report yourself.");
            return;
        }

        if (!reportDetails) {
            player.sendMessage("§cPlease provide details for your report.");
            return;
        }

        addReport(reportType, player.name, reportedPlayerName, reportDetails);
        setCooldown(player.name);

        const reportMessage = `§7[§b#§7] §eNew Report:\n§7- Type: §e${reportType}\n§7- Reporter: §e${player.name}\n§7- Reported Player: §e${reportedPlayerName}\n§7- Details: §e${reportDetails}`;

        const admins = world.getPlayers({ tags: ["admin"] });
        if (admins.length === 0) {
            console.warn("No admins online to receive reports.");
        } else {
            admins.forEach(admin => {
                admin.sendMessage(reportMessage);
                system.run(() => admin.runCommand("playsound random.orb @s"));
            });
        }

        player.sendMessage(`§aYour report has been submitted. (${activeReports.length + 1}/${maxActiveReports} active reports)`);
    }).catch((error) => {
        console.error("Error in ReportUserPanel:", error);
        player.sendMessage("§cFailed to submit your report. Please try again.");
    });
}

export function ReportManagePanel(player, page = 0) {
    const reports = getAllReports().filter(r => !r.resolved);
    const totalPages = Math.ceil(reports.length / maxPerPage);
    const start = page * maxPerPage;
    const end = start + maxPerPage;
    const pageReports = reports.slice(start, end);

    if (reports.length === 0) {
        const form = new ActionFormData()
            .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §eManage Reports")
            .body("§aThere are no active reports.")
            .button(customFormUICodes.action.buttons.positions.left_side_only + "Back", "textures/items/tipped_arrow_fireres");

        form.show(player).then((response) => {
            if (response.canceled) return;
            showModerationUI(player);
        });
        return;
    }

    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §eManage Reports")
        .body(`§7Page §e${page + 1} §7of §e${totalPages}\n§7Total active reports: §e${reports.length}`);

    pageReports.forEach((report, index) => {
        form.button(
            customFormUICodes.action.buttons.positions.main_only + 
            `§e#${start + index + 1} §7- §e${report.type}\n§7Reporter: §e${report.reporter} §7-> §e${report.reportedPlayerName}`,
            "textures/items/name_tag"
        );
    });

    if (page > 0) {
        form.button(customFormUICodes.action.buttons.positions.main_only + "§aPrevious Page", "textures/ui/arrow_left");
    }
    if (page < totalPages - 1) {
        form.button(customFormUICodes.action.buttons.positions.main_only + "§aNext Page", "textures/ui/arrow_right");
    }
    form.button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled) return;

        const navOffset = (page > 0 ? 1 : 0) + (page < totalPages - 1 ? 1 : 0);
        
        if (response.selection < pageReports.length) {
            const selectedReport = pageReports[response.selection];
            manageReportDetails(player, selectedReport, page);
        } else if (response.selection === pageReports.length && page > 0) {
            ReportManagePanel(player, page - 1);
        } else if ((response.selection === pageReports.length + (page > 0 ? 1 : 0)) && page < totalPages - 1) {
            ReportManagePanel(player, page + 1);
        } else {
            showModerationUI(player);
        }
    }).catch((error) => {
        console.error("Error in ReportManagePanel:", error);
        player.sendMessage("§cFailed to load reports. Please try again.");
    });
}

function manageReportDetails(player, report, returnPage) {
    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §eReport Details")
        .body(
            `§7Type: §e${report.type}\n\n` +
            `§7Reporter: §e${report.reporter}\n\n` +
            `§7Reported Player: §e${report.reportedPlayerName}\n\n` +
            `§7Details: §e${report.details}\n\n` +
            `§7Date: §e${report.date}`
        )
        .button(customFormUICodes.action.buttons.positions.main_only + "§aResolve Report", "textures/ui/realms_green_check.png")
        .button(customFormUICodes.action.buttons.positions.main_only + "§cDelete Report", "textures/ui/redX1.png")
        .button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === 2) {
            ReportManagePanel(player, returnPage);
            return;
        }

        switch (response.selection) {
            case 0:
                resolveReport(report.id);
                player.sendMessage(`§aReport by §e${report.reporter} §ahas been resolved.`);
                break;
            case 1:
                deleteReport(report.id);
                player.sendMessage(`§aReport by §e${report.reporter} §ahas been deleted.`);
                break;
        }
        ReportManagePanel(player, returnPage);
    }).catch((error) => {
        console.error("Error in manageReportDetails:", error);
        player.sendMessage("§cFailed to manage report. Please try again.");
    });
}