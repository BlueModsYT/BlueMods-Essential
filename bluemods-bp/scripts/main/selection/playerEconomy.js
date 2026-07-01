import { world, system, ItemStack, EnchantmentTypes } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { showCompassUI } from "../playerCompass.js";
import { showModerationUI } from "../playerModeration.js";
import { customFormUICodes } from "../../handler/customFormUICodes.js";
import main from "../../config.js";

const AUCTION_KEY = "auctionItems";
const AUCTION_REQUESTS_KEY = "auctionRequests";
const AUCTION_ENABLED_KEY = "auctionEnabled";
const MONEY_OBJECTIVE_KEY = "moneyObjective";
const PENDING_DELIVERIES_KEY = "pendingDeliveries";
const PENDING_MONEY_KEY = "pendingMoney";
const DEFAULT_MONEY = "Money";

function getAuctionItems() {
    const data = world.getDynamicProperty(AUCTION_KEY);
    return data ? JSON.parse(data) : [];
}

function saveAuctionItems(items) {
    world.setDynamicProperty(AUCTION_KEY, JSON.stringify(items));
}

function getAuctionRequests() {
    const data = world.getDynamicProperty(AUCTION_REQUESTS_KEY);
    return data ? JSON.parse(data) : [];
}

function saveAuctionRequests(requests) {
    world.setDynamicProperty(AUCTION_REQUESTS_KEY, JSON.stringify(requests));
}

function getPendingDeliveries() {
    const data = world.getDynamicProperty(PENDING_DELIVERIES_KEY);
    return data ? JSON.parse(data) : [];
}

function savePendingDeliveries(deliveries) {
    world.setDynamicProperty(PENDING_DELIVERIES_KEY, JSON.stringify(deliveries));
}

function isAuctionEnabled() {
    return world.getDynamicProperty(AUCTION_ENABLED_KEY) !== false;
}

function getMoneyObjective() {
    return world.getDynamicProperty(MONEY_OBJECTIVE_KEY) || DEFAULT_MONEY;
}

function getPlayerMoney(player) {
    try {
        const obj = world.scoreboard.getObjective(getMoneyObjective());
        return obj ? obj.getScore(player.scoreboardIdentity) || 0 : 0;
    } catch {
        return 0;
    }
}

function setPlayerMoney(player, amount) {
    try {
        const obj = world.scoreboard.getObjective(getMoneyObjective());
        if (obj) obj.setScore(player.scoreboardIdentity, amount);
    } catch {}
}

function addPlayerMoney(player, amount) {
    const current = getPlayerMoney(player);
    setPlayerMoney(player, current + amount);
}

function removePlayerMoney(player, amount) {
    const current = getPlayerMoney(player);
    if (current >= amount) {
        setPlayerMoney(player, current - amount);
        return true;
    }
    return false;
}

function queueMoney(playerId, amount) {
    const data = world.getDynamicProperty(PENDING_MONEY_KEY);
    const pending = data ? JSON.parse(data) : {};
    pending[playerId] = (pending[playerId] || 0) + amount;
    world.setDynamicProperty(PENDING_MONEY_KEY, JSON.stringify(pending));
}

function claimPendingMoney(player) {
    const data = world.getDynamicProperty(PENDING_MONEY_KEY);
    const pending = data ? JSON.parse(data) : {};
    if (pending[player.id]) {
        const amount = pending[player.id];
        addPlayerMoney(player, amount);
        delete pending[player.id];
        world.setDynamicProperty(PENDING_MONEY_KEY, JSON.stringify(pending));
        player.sendMessage(`§7[§a+§7] §aYou received §2$${amount} §afrom auction sales while offline!`);
        system.run(() => player.runCommand('playsound random.levelup @s'));
    }
}

function queueDelivery(sellerId, sellerName, itemType, amount, itemData, price, buyerName) {
    const deliveries = getPendingDeliveries();
    deliveries.push({
        id: Date.now().toString(),
        sellerId,
        sellerName,
        itemType,
        amount,
        itemData: itemData || null,
        price,
        buyerName,
        timestamp: Date.now()
    });
    savePendingDeliveries(deliveries);
}

function hasInventorySpace(player) {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return false;
    for (let i = 0; i < inventory.size; i++) {
        if (!inventory.getItem(i)) return true;
    }
    return false;
}

function deliverToPlayer(player) {
    const deliveries = getPendingDeliveries();
    const playerDeliveries = deliveries.filter(d => d.sellerId === player.id);

    if (playerDeliveries.length === 0) {
        claimPendingMoney(player);
        return;
    }

    if (!hasInventorySpace(player)) {
        player.sendMessage(`§7[§c!§7] §cYou have §e${playerDeliveries.length} §cpending item(s) but your inventory is full! Clear at least 1 slot.`);
        claimPendingMoney(player);
        return;
    }

    let delivered = 0;

    for (const delivery of playerDeliveries) {
        if (!hasInventorySpace(player)) break;

        const inventory = player.getComponent("minecraft:inventory")?.container;
        if (inventory) {
            const newItem = new ItemStack(delivery.itemType, delivery.amount);
            if (delivery.itemData?.nameTag) newItem.nameTag = delivery.itemData.nameTag;
            if (delivery.itemData?.lore?.length > 0) newItem.setLore(delivery.itemData.lore);
            if (delivery.itemData?.enchantments?.length > 0) {
                const enchantable = newItem.getComponent("enchantable");
                if (enchantable) {
                    for (const enchant of delivery.itemData.enchantments) {
                        const enchantType = EnchantmentTypes.get(enchant.type);
                        if (enchantType) {
                            enchantable.addEnchantment({ type: enchantType, level: enchant.level });
                        }
                    }
                }
            }
            inventory.addItem(newItem);
            delivered++;
        }
    }

    const remaining = deliveries.filter(d => !(d.sellerId === player.id && playerDeliveries.slice(0, delivered).some(pd => pd.id === d.id)));
    savePendingDeliveries(remaining);

    if (delivered > 0) {
        player.sendMessage(`§7[§a+§7] §aYou received §e${delivered} §aitem(s) from auction sales!`);
        system.run(() => player.runCommand('playsound random.levelup @s'));
    }
    
    claimPendingMoney(player);
}

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        deliverToPlayer(player);
    }
}, 100);

world.afterEvents.playerJoin.subscribe((event) => {
    const { playerId } = event;
    system.runTimeout(() => {
        const player = world.getPlayers().find(p => p.id === playerId);
        if (player) deliverToPlayer(player);
    }, 40);
});

export function showEconomy(player) {
    const form = new ActionFormData()
    .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aEconomy")
    .body("Choose an option:");

    form.button(customFormUICodes.action.buttons.positions.main_only + "§aAuction Shop", "textures/ui/sidebar_icons/marketplace")
        .button(customFormUICodes.action.buttons.positions.main_only + "Inventory", "textures/ui/sidebar_icons/star")
        .button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled) return;

        switch (response.selection) {
            case 0: showAuctionShop(player); break;
            case 1: showInventory(player); break;
            case 2: showCompassUI(player); break;
        }
    }).catch((error) => {
        console.error("Failed to Show Economy UI:", error);
    });
}

function showInventory(player) {
    const form = new ActionFormData()
    .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aAuction Inventory")
    .body("Choose an option:");

    form.button(customFormUICodes.action.buttons.positions.main_only + "Request Auction", "textures/ui/color_plus")
        .button(customFormUICodes.action.buttons.positions.main_only + "My Requests", "textures/items/name_tag")
        .button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled) return;

        switch (response.selection) {
            case 0: requestAuctionItem(player); break;
            case 1: showMyRequests(player); break;
            case 2: showEconomy(player); break;
        }
    }).catch((error) => {
        console.error("Failed to Show Economy UI:", error);
    });
}

function requestAuctionItem(player) {
    if (!isAuctionEnabled()) {
        player.sendMessage("§7[§c-§7] §cThe auction shop is currently closed.");
        return;
    }
    
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return;

    const itemSlots = [];
    const itemNames = [];

    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (item && item.typeId !== "air") {
            itemSlots.push(i);
            itemNames.push(`${item.typeId.replace("minecraft:", "")} x${item.amount}`);
        }
    }

    if (itemSlots.length === 0) {
        player.sendMessage("§7[§c-§7] §cYou have no items to auction.");
        return;
    }

    const form = new ModalFormData()
        .title(customFormUICodes.modal.titles.formStyles.general + "§l§bBlueMods §7| §aRequest Auction")
        .dropdown("Select item to auction:", itemNames)
        .textField("Price (in money):", "100")
        .textField("Description:", "Selling this item!");

    form.show(player).then((response) => {
        if (response.canceled) return;

        const dropdownIndex = response.formValues[0];
        const price = parseInt(response.formValues[1]);
        const description = response.formValues[2] || "No description";

        if (isNaN(price) || price <= 0) {
            player.sendMessage("§7[§c-§7] §cInvalid price.");
            return;
        }

        const actualSlot = itemSlots[dropdownIndex];
        const selectedItem = inventory.getItem(actualSlot);
        if (!selectedItem) {
            player.sendMessage("§7[§c-§7] §cItem not found.");
            return;
        }
        
        const itemData = {
            typeId: selectedItem.typeId,
            amount: selectedItem.amount,
            nameTag: selectedItem.nameTag || null,
            lore: selectedItem.getLore?.() || [],
            enchantments: selectedItem.getComponent?.("enchantable")?.getEnchantments?.().map(e => ({
                type: e.type.id,
                level: e.level
            })) || []
        };

        const requests = getAuctionRequests();
        requests.push({
            id: Date.now().toString(),
            seller: player.name,
            sellerId: player.id,
            itemType: selectedItem.typeId,
            amount: selectedItem.amount,
            itemData: itemData,
            price: price,
            description: description,
            status: "pending",
            timestamp: Date.now()
        });
        saveAuctionRequests(requests);

        inventory.setItem(actualSlot, undefined);
        player.sendMessage("§7[§a+§7] §aAuction request submitted. Wait for admin approval.");

        world.getPlayers({ tags: ["notify"] }).forEach(admin => {
            admin.sendMessage(`§7[§e#§7] §e${player.name} §arequested to auction §e${selectedItem.typeId.replace("minecraft:", "")} §afor §2$${price}`);
            system.run(() => admin.runCommand('playsound note.pling @s'));
        });
    });
}

function showMyRequests(player) {
    const requests = getAuctionRequests().filter(r => r.sellerId === player.id);

    if (requests.length === 0) {
        player.sendMessage("§7[§c-§7] §cYou have no pending requests.");
        return;
    }

    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aMy Requests")
        .body("Click a request to cancel:");

    requests.forEach(req => {
        const status = req.status === "pending" ? "§ePending" : req.status === "approved" ? "§aApproved" : "§cRejected";
        form.button(
            customFormUICodes.action.buttons.positions.main_only + `§e${req.itemType.replace("minecraft:", "")} x${req.amount}\n§7Price: §2$${req.price} §7| ${status}`,
            "textures/items/name_tag"
        );
    });

    form.button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled) return;
        if (response.selection === requests.length) { showEconomy(player); return; }

        const selectedRequest = requests[response.selection];
        if (selectedRequest.status === "pending") {
            cancelAuctionRequest(player, selectedRequest);
        } else {
            player.sendMessage("§7[§c-§7] §cThis request has already been processed.");
        }
    });
}

function cancelAuctionRequest(player, request) {
    const requests = getAuctionRequests();
    const updated = requests.filter(r => r.id !== request.id);
    saveAuctionRequests(updated);

    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (inventory) {
        const newItem = new ItemStack(request.itemType, request.amount);
        if (request.itemData?.nameTag) newItem.nameTag = request.itemData.nameTag;
        if (request.itemData?.lore?.length > 0) newItem.setLore(request.itemData.lore);
        if (request.itemData?.enchantments?.length > 0) {
            const enchantable = newItem.getComponent("enchantable");
            if (enchantable) {
                for (const enchant of request.itemData.enchantments) {
                    const enchantType = EnchantmentTypes.get(enchant.type);
                    if (enchantType) {
                        enchantable.addEnchantment({ type: enchantType, level: enchant.level });
                    }
                }
            }
        }
        inventory.addItem(newItem);
    }
    player.sendMessage("§7[§a+§7] §aRequest cancelled. Item returned to inventory.");
}

function showAuctionShop(player) {
    if (!isAuctionEnabled()) {
        player.sendMessage("§7[§c-§7] §cThe auction shop is currently closed.");
        return;
    }

    const items = getAuctionItems();

    if (items.length === 0) {
        const form = new ActionFormData()
            .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aAuction Shop")
            .body("§7No items available for auction.")
            .button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

        form.show(player).then((response) => {
            if (response.canceled) return;
            showEconomy(player);
        });
        return;
    }

    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aAuction Shop")
        .body("Select an item to purchase:");

    items.forEach(item => {
        form.button(
            customFormUICodes.action.buttons.positions.main_only + `§e${item.itemType.replace("minecraft:", "")} x${item.amount}\n§7Seller: §e${item.seller}\n§7Price: §2$${item.price}\n§7${item.description}`,
            "textures/ui/sidebar_icons/marketplace"
        );
    });
    


    form.button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled) return;
        if (response.selection === items.length) { showEconomy(player); return; }

        const selectedItem = items[response.selection];
        purchaseAuctionItem(player, selectedItem);
    });
}

function purchaseAuctionItem(player, item) {
    if (item.sellerId === player.id) {
        player.sendMessage("§7[§c-§7] §cYou cannot purchase your own item.");
        return;
    }

    const buyerMoney = getPlayerMoney(player);
    if (buyerMoney < item.price) {
        player.sendMessage(`§7[§c-§7] §cYou don't have enough money. Need §2$${item.price}§c, have §2$${buyerMoney}§c.`);
        return;
    }

    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aConfirm Purchase")
        .body(
            `Item: §e${item.itemType.replace("minecraft:", "")} x${item.amount}\n` +
            `Seller: §e${item.seller}\n` +
            `Price: §2$${item.price}\n\n` +
            `§aYour balance: §2$${buyerMoney}`
        )
        .button(customFormUICodes.action.buttons.positions.left_side_only + "§aConfirm Purchase", "textures/ui/realms_green_check.png")
        .button(customFormUICodes.action.buttons.positions.left_side_only + "§cCancel", "textures/ui/redX1.png");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === 1) return;

        if (!removePlayerMoney(player, item.price)) {
            player.sendMessage("§7[§c-§7] §cTransaction failed.");
            return;
        }

        const seller = world.getPlayers().find(p => p.id === item.sellerId);
        if (seller) {
            addPlayerMoney(seller, item.price);
        } else {
            queueMoney(item.sellerId, item.price);
        }

        const inventory = player.getComponent("minecraft:inventory")?.container;
        if (inventory) {
            const newItem = new ItemStack(item.itemType, item.amount);
            if (item.itemData?.nameTag) newItem.nameTag = item.itemData.nameTag;
            if (item.itemData?.lore?.length > 0) newItem.setLore(item.itemData.lore);
            if (item.itemData?.enchantments?.length > 0) {
                const enchantable = newItem.getComponent("enchantable");
                if (enchantable) {
                    for (const enchant of item.itemData.enchantments) {
                        const enchantType = EnchantmentTypes.get(enchant.type);
                        if (enchantType) {
                            enchantable.addEnchantment({ type: enchantType, level: enchant.level });
                        }
                    }
                }
            }
            inventory.addItem(newItem);
        }

        const items = getAuctionItems();
        const updated = items.filter(i => i.id !== item.id);
        saveAuctionItems(updated);

        if (seller) {
            seller.sendMessage(`§7[§a+§7] §aYour item §e${item.itemType.replace("minecraft:", "")} §awas purchased by §e${player.name} §afor §2$${item.price}§a.`);
        }

        player.sendMessage(`§7[§a+§7] §aPurchased §e${item.itemType.replace("minecraft:", "")} x${item.amount} §afor §2$${item.price}§a.`);
    });
}

//
//  Admin Management 
//

export function ManageAuctionShop(player) {
    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aManage Auctions")
        .body("Admin Panel:");

    form.button(customFormUICodes.action.buttons.positions.main_only + "§ePending Requests", "textures/ui/icon_book_writable")
        .button(customFormUICodes.action.buttons.positions.main_only + "§aActive Auctions", "textures/ui/sidebar_icons/marketplace")
        .button(customFormUICodes.action.buttons.positions.main_only + "§6Set Money Objective", "textures/ui/icon_setting")
        .button(isAuctionEnabled() ? customFormUICodes.action.buttons.positions.main_only + "§cClose Auction Shop" : "§aOpen Auction Shop", "textures/ui/toggle")
        .button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled) return;

        switch (response.selection) {
            case 0: showPendingRequests(player); break;
            case 1: showAdminAuctionList(player); break;
            case 2: setMoneyObjective(player); break;
            case 3: toggleAuctionShop(player); break;
            case 4: showModerationUI(player); break;
        }
    });
}

function showPendingRequests(player) {
    const requests = getAuctionRequests().filter(r => r.status === "pending");

    if (requests.length === 0) {
        player.sendMessage("§7[§c-§7] §cNo pending requests.");
        ManageAuctionShop(player);
        return;
    }

    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aPending Requests")
        .body("Approve or reject:");

    requests.forEach(req => {
        form.button(customFormUICodes.action.buttons.positions.main_only + 
            `§e${req.seller} §7- §e${req.itemType.replace("minecraft:", "")} x${req.amount}\n§7Price: §2$${req.price}\n§7${req.description}`,
            "textures/items/name_tag"
        );
    });

    form.button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled) return;
        if (response.selection === requests.length) { ManageAuctionShop(player); return; }

        const req = requests[response.selection];
        showRequestAction(player, req);
    });
}

function showRequestAction(player, request) {
    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aRequest Action")
        .body(
            `Seller: §e${request.seller}\n\n` +
            `§fItem: §e${request.itemType.replace("minecraft:", "")} x${request.amount}\n\n` +
            `§fPrice: §a$${request.price}\n\n` +
            `§fDescription: §e${request.description}`
        )
        .button(customFormUICodes.action.buttons.positions.main_only + "§aApprove", "textures/ui/realms_green_check.png")
        .button(customFormUICodes.action.buttons.positions.main_only + "§cReject", "textures/ui/redX1.png")
        .button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === 2) { showPendingRequests(player); return; }

        const requests = getAuctionRequests();

        if (response.selection === 0) {
            const items = getAuctionItems();
            items.push({
                id: request.id,
                seller: request.seller,
                sellerId: request.sellerId,
                itemType: request.itemType,
                amount: request.amount,
                itemData: request.itemData,
                price: request.price,
                description: request.description,
                listedAt: Date.now()
            });
            saveAuctionItems(items);

            const updated = requests.map(r => r.id === request.id ? { ...r, status: "approved" } : r);
            saveAuctionRequests(updated);

            player.sendMessage("§7[§a+§7] §aAuction request approved.");
        } else {
            const updated = requests.map(r => r.id === request.id ? { ...r, status: "rejected" } : r);
            saveAuctionRequests(updated);

            const seller = world.getPlayers().find(p => p.id === request.sellerId);
            if (seller) {
                const inventory = seller.getComponent("minecraft:inventory")?.container;
                if (inventory) {
                    const newItem = new ItemStack(request.itemType, request.amount);
                    if (request.itemData?.nameTag) newItem.nameTag = request.itemData.nameTag;
                    if (request.itemData?.lore?.length > 0) newItem.setLore(request.itemData.lore);
                    if (request.itemData?.enchantments?.length > 0) {
                        const enchantable = newItem.getComponent("enchantable");
                        if (enchantable) {
                            for (const enchant of request.itemData.enchantments) {
                                const enchantType = EnchantmentTypes.get(enchant.type);
                                if (enchantType) {
                                    enchantable.addEnchantment({ type: enchantType, level: enchant.level });
                                }
                            }
                        }
                    }
                    inventory.addItem(newItem);
                }
                seller.sendMessage("§7[§c-§7] §cYour auction request was rejected. Item returned.");
            } else {
                queueDelivery(request.sellerId, request.seller, request.itemType, request.amount, request.itemData, 0, "Admin");
            }

            player.sendMessage("§7[§c-§7] §cAuction request rejected.");
        }

        showPendingRequests(player);
    });
}

function showAdminAuctionList(player) {
    const items = getAuctionItems();

    if (items.length === 0) {
        player.sendMessage("§7[§c-§7] §cNo active auctions.");
        ManageAuctionShop(player);
        return;
    }

    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§bBlueMods §7| §aActive Auctions")
        .body("Click to remove an item:");

    items.forEach(item => {
        form.button(customFormUICodes.action.buttons.positions.main_only + 
            `§e${item.itemType.replace("minecraft:", "")} x${item.amount}\n§7Seller: §e${item.seller} §7- §2$${item.price}`,
            "textures/ui/sidebar_icons/marketplace"
        );
    });

    form.button(customFormUICodes.action.buttons.positions.left_side_only + "§gBack", "textures/items/tipped_arrow_fireres");

    form.show(player).then((response) => {
        if (response.canceled) return;
        if (response.selection === items.length) { ManageAuctionShop(player); return; }

        const item = items[response.selection];
        confirmRemoveAuctionItem(player, item);
    });
}

function confirmRemoveAuctionItem(player, item) {
    const form = new ActionFormData()
        .title(customFormUICodes.action.titles.formStyles.gridMenu + "§l§cRemove Auction Item")
        .body(
            `Item: §e${item.itemType.replace("minecraft:", "")} x${item.amount}\n\n` +
            `§fSeller: §e${item.seller}\n\n` +
            `§fPrice: §a$${item.price}\n\n` +
            `§cThe item will be returned to the seller.`
        )
        .button(customFormUICodes.action.buttons.positions.main_only + "§aConfirm Removal", "textures/ui/realms_green_check.png")
        .button(customFormUICodes.action.buttons.positions.main_only + "§cCancel", "textures/ui/redX1.png");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === 1) return;

        const items = getAuctionItems();
        const updated = items.filter(i => i.id !== item.id);
        saveAuctionItems(updated);

        const seller = world.getPlayers().find(p => p.id === item.sellerId);
        if (seller) {
            const inventory = seller.getComponent("minecraft:inventory")?.container;
            if (inventory) {
                const newItem = new ItemStack(item.itemType, item.amount);
                if (item.itemData?.nameTag) newItem.nameTag = item.itemData.nameTag;
                if (item.itemData?.lore?.length > 0) newItem.setLore(item.itemData.lore);
                if (item.itemData?.enchantments?.length > 0) {
                    const enchantable = newItem.getComponent("enchantable");
                    if (enchantable) {
                        for (const enchant of item.itemData.enchantments) {
                            const enchantType = EnchantmentTypes.get(enchant.type);
                            if (enchantType) {
                                enchantable.addEnchantment({ type: enchantType, level: enchant.level });
                            }
                        }
                    }
                }
                inventory.addItem(newItem);
            }
            seller.sendMessage("§7[§a+§7] §aYour auction item was returned by an admin.");
        } else {
            queueDelivery(item.sellerId, item.seller, item.itemType, item.amount, item.itemData, 0, "Admin");
        }

        player.sendMessage("§7[§a+§7] §aItem removed and returned to seller.");
        ManageAuctionShop(player);
    });
}

function setMoneyObjective(player) {
    const current = getMoneyObjective();

    const form = new ModalFormData()
        .title(customFormUICodes.modal.titles.formStyles.general + "§l§bBlueMods §7| §aSet Money Objective")
        .textField("Enter scoreboard objective name:", current);

    form.show(player).then((response) => {
        if (response.canceled) { ManageAuctionShop(player); return; }

        const objective = response.formValues[0]?.trim();
        if (!objective) {
            player.sendMessage("§7[§c-§7] §cObjective name cannot be empty.");
            return;
        }

        world.setDynamicProperty(MONEY_OBJECTIVE_KEY, objective);
        player.sendMessage(`§7[§a+§7] §aMoney objective set to §e${objective}§a.`);
        ManageAuctionShop(player);
    });
}

function toggleAuctionShop(player) {
    const enabled = isAuctionEnabled();
    world.setDynamicProperty(AUCTION_ENABLED_KEY, !enabled);
    player.sendMessage(`§7[§a+§7] §aAuction shop is now §e${!enabled ? "Open" : "Closed"}§a.`);
    ManageAuctionShop(player);
}



