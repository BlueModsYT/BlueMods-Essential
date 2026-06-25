# This Setup Function is made by SafeGuard AntiCheat - blazer.dev

# Add necessary scoreboard objectives
scoreboard objectives add bluemods:vanish dummy
scoreboard objectives add bluemods:notify dummy
scoreboard objectives add bluemods:setup_success dummy

scoreboard players add @a bluemods:setup_success 0

scoreboard players set @a[scores={bluemods:setup_success=0..}] bluemods:gametest_on 0
scoreboard players set @a[scores={bluemods:setup_success=0,bluemods:gametest_on=0}] bluemods:setup_success 2

# Disable command feedback
gamerule sendcommandfeedback false
gamerule commandblockoutput false

# Success 
tellraw @s[scores={bluemods:setup_success=3..}] {"rawtext":[{"text":"§7[§bBlueMods§7]§r§c§l "},{"text":"SETUP ERROR: §r§4AntiCheat already setup!§r"}]}

playsound random.levelup @s[scores={bluemods:setup_success=2}]
execute as @s[scores={bluemods:setup_success=2}] run function credit
tellraw @s[scores={bluemods:setup_success=2}] {"rawtext":[{"text":"§7[§bBlueMods§7]§r Add tag §eadmin§r to all the staff §o/tag NAME add admin§r"}]}
tellraw @s[scores={bluemods:setup_success=2}] {"rawtext":[{"text":"§7[§bBlueMods§7]§r §aSuccessfully setup the anti-cheat!§r"}]}
execute as @s[scores={bluemods:setup_success=2}] run scoreboard players set @s bluemods:setup_success 3
# Errors
tellraw @s[scores={bluemods:setup_success=0..1}] {"rawtext":[{"text":"§7[§bBlueMods§7]§r§c§l "},{"text":"SETUP ERROR: §r§4Experiments Required, turn on §7Beta APIs§r"}]}


playsound random.anvil_land @s[scores={bluemods:setup_success=0..1}]

