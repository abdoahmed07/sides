using OBP200_RolePlayingGame;
using System.Text;

class Program
{
    // Player is stored as a Player object to access stats like gold and level.
    static Player? player;

    static List<string[]> Rooms = new List<string[]>();

    // Enemy templates used as a base when generating enemies.
    static List<Enemy> EnemyTemplates = new List<Enemy>();

    static int CurrentRoomIndex = 0;

    static Random Rng = new Random();

    // ======= Main =======

    static void Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        InitEnemyTemplates();

        while (true)
        {
            ShowMainMenu();
            Console.Write("Choose: ");
            var choice = (Console.ReadLine() ?? "").Trim();

            if (choice == "1")
            {
                StartNewGame();
                RunGameLoop();
            }
            else if (choice == "2")
            {
                Console.WriteLine("Exiting...");
                return;
            }
            else
            {
                Console.WriteLine("Invalid choice.");
            }

            Console.WriteLine();
        }
    }

    // ======= Menu & Init =======

    static void ShowMainMenu()
    {
        Console.WriteLine("=== Text-RPG ===");
        Console.WriteLine("1. New Game");
        Console.WriteLine("2. Exit");
    }

    static void StartNewGame()
    {
        Console.Write("Enter name: ");
        var name = (Console.ReadLine() ?? "").Trim();
        if (string.IsNullOrWhiteSpace(name)) name = "Nameless";

        Console.WriteLine("Choose class: 1) Warrior  2) Mage  3) Rogue");
        Console.Write("Choice: ");
        var k = (Console.ReadLine() ?? "").Trim();

        string cls = "Warrior";
        int hp = 0, maxhp = 0, atk = 0, def = 0;
        int potions = 0, gold = 0;

        // Set starting values based on chosen class.
        switch (k)
        {
            case "1": // Warrior: tanky
                cls = "Warrior"; maxhp = 40; hp = 40; atk = 7; def = 5; potions = 2; gold = 15;
                break;
            case "2": // Mage: high damage, low defense
                cls = "Mage"; maxhp = 28; hp = 28; atk = 10; def = 2; potions = 2; gold = 15;
                break;
            case "3": // Rogue: crit chance
                cls = "Rogue"; maxhp = 32; hp = 32; atk = 8; def = 3; potions = 3; gold = 20;
                break;
            default:
                cls = "Warrior"; maxhp = 40; hp = 40; atk = 7; def = 5; potions = 2; gold = 15;
                break;
        }

        player = new Player
        {
            Name = name,
            CharacterClass = cls,
            MaxHealth = maxhp,
            Attack = atk,
            Defense = def,
            Gold = gold,
            Experience = 0,
            Level = 1,
            Potions = potions,
            Inventory = new List<Item>
            {
                new Item("Wooden Sword"),
                new Item("Cloth Armor")
            }
        };
        player.SetHealth(hp);

        // Build the list of rooms for the adventure.
        Rooms.Clear();
        Rooms.Add(new[] { "battle",   "Forest Path"     });
        Rooms.Add(new[] { "treasure", "Old Chest"       });
        Rooms.Add(new[] { "shop",     "Travelling Merchant" });
        Rooms.Add(new[] { "battle",   "Cave Entrance"   });
        Rooms.Add(new[] { "rest",     "Campfire"        });
        Rooms.Add(new[] { "battle",   "Cave Depths"     });
        Rooms.Add(new[] { "boss",     "The Ancient Dragon" });

        CurrentRoomIndex = 0;

        Console.WriteLine($"Welcome, {name} the {cls}!");
        ShowStatus();
    }

    static void RunGameLoop()
    {
        while (true)
        {
            var room = Rooms[CurrentRoomIndex];
            Console.WriteLine($"--- Room {CurrentRoomIndex + 1}/{Rooms.Count}: {room[1]} ({room[0]}) ---");

            bool continueAdventure = EnterRoom(room[0]);

            if (IsPlayerDead())
            {
                Console.WriteLine("You have fallen... Game over.");
                break;
            }

            if (!continueAdventure)
            {
                Console.WriteLine("You leave the adventure for now.");
                break;
            }

            CurrentRoomIndex++;

            if (CurrentRoomIndex >= Rooms.Count)
            {
                Console.WriteLine();
                Console.WriteLine("You have completed the adventure!");
                break;
            }

            Console.WriteLine();
            Console.WriteLine("[C] Continue     [Q] Quit to main menu");
            Console.Write("Choice: ");
            var post = (Console.ReadLine() ?? "").Trim().ToUpperInvariant();

            if (post == "Q")
            {
                Console.WriteLine("Back to main menu.");
                break;
            }

            Console.WriteLine();
        }
    }

    // ======= Room Handling =======

    static bool EnterRoom(string type)
    {
        switch ((type ?? "battle").Trim())
        {
            case "battle":   return DoBattle(isBoss: false);
            case "boss":     return DoBattle(isBoss: true);
            case "treasure": return DoTreasure();
            case "shop":     return DoShop();
            case "rest":     return DoRest();
            default:
                Console.WriteLine("You move on...");
                return true;
        }
    }

    // ======= Combat =======

    static bool DoBattle(bool isBoss)
    {
        // enemy is declared as the base class Character - polymorphism.
        Character enemy = GenerateEnemy(isBoss);

        Console.WriteLine($"A {enemy.Name} appears! (HP {enemy.Health}, ATK {enemy.Attack}, DEF {enemy.Defense})");

        while (enemy.Health > 0 && !IsPlayerDead())
        {
            Console.WriteLine();
            ShowStatus();
            Console.WriteLine($"Enemy: {enemy.Name} HP={enemy.Health}");
            Console.WriteLine("[A] Attack   [X] Special   [P] Potion   [R] Run");
            if (isBoss) Console.WriteLine("(You cannot run from a boss!)");
            Console.Write("Choice: ");

            var cmd = (Console.ReadLine() ?? "").Trim().ToUpperInvariant();

            if (cmd == "A")
            {
                int damage = CalculatePlayerDamage(enemy.Defense);
                enemy.TakeDamage(damage);
                Console.WriteLine($"You hit {enemy.Name} for {damage} damage.");
            }
            else if (cmd == "X")
            {
                int special = UseClassSpecial(enemy.Defense, isBoss);
                enemy.TakeDamage(special);
                Console.WriteLine($"Special! {enemy.Name} takes {special} damage.");
            }
            else if (cmd == "P")
            {
                UsePotion();
            }
            else if (cmd == "R" && !isBoss)
            {
                if (TryRunAway())
                {
                    Console.WriteLine("You escaped!");
                    return true;
                }
                else
                {
                    Console.WriteLine("Failed to escape!");
                }
            }
            else
            {
                Console.WriteLine("You hesitate...");
            }

            if (enemy.Health <= 0) break;

            // Enemy attack - DealDamage() is called polymorphically.
            int enemyDamage = CalculateEnemyDamage(enemy);
            ApplyDamageToPlayer(enemyDamage);
            Console.WriteLine($"{enemy.Name} attacks and deals {enemyDamage} damage!");
        }

        if (IsPlayerDead()) return false;

        // Cast to Enemy only to retrieve XP and gold rewards.
        if (enemy is Enemy defeatedEnemy)
        {
            AddPlayerXp(defeatedEnemy.XpReward);
            AddPlayerGold(defeatedEnemy.GoldReward);
            Console.WriteLine($"Victory! +{defeatedEnemy.XpReward} XP, +{defeatedEnemy.GoldReward} gold.");
            MaybeDropLoot(defeatedEnemy.Name);
        }

        return true;
    }

    static Enemy GenerateEnemy(bool isBoss)
    {
        if (isBoss)
        {
            var boss = new Enemy { Name = "Ancient Dragon", Attack = 9, Defense = 4, XpReward = 30, GoldReward = 50 };
            boss.SetHealth(55);
            return boss;
        }
        else
        {
            // Pick a random template and vary the stats slightly.
            var template = EnemyTemplates[Rng.Next(EnemyTemplates.Count)];
            var enemy = new Enemy
            {
                Name = template.Name,
                Attack = template.Attack + Rng.Next(0, 2),
                Defense = template.Defense + Rng.Next(0, 2),
                XpReward = template.XpReward + Rng.Next(0, 3),
                GoldReward = template.GoldReward + Rng.Next(0, 3)
            };
            enemy.SetHealth(template.Health + Rng.Next(-1, 3));
            return enemy;
        }
    }

    // Creates the enemy templates used as a base when generating enemies.
    static void InitEnemyTemplates()
    {
        var e1 = new Enemy { Name = "Wild Boar", Attack = 4, Defense = 1, XpReward = 6, GoldReward = 4 };
        e1.SetHealth(18);
        EnemyTemplates.Add(e1);

        var e2 = new Enemy { Name = "Skeleton", Attack = 5, Defense = 2, XpReward = 7, GoldReward = 5 };
        e2.SetHealth(20);
        EnemyTemplates.Add(e2);

        var e3 = new Enemy { Name = "Bandit", Attack = 6, Defense = 1, XpReward = 8, GoldReward = 6 };
        e3.SetHealth(16);
        EnemyTemplates.Add(e3);

        var e4 = new Enemy { Name = "Slime", Attack = 3, Defense = 0, XpReward = 5, GoldReward = 3 };
        e4.SetHealth(14);
        EnemyTemplates.Add(e4);
    }

    // Calculates player damage against the enemy, including class bonus and randomness.
    static int CalculatePlayerDamage(int enemyDef)
    {
        if (player == null) return 0;
        int baseDmg = Math.Max(1, player.Attack - (enemyDef / 2));
        int roll = Rng.Next(0, 3);

        switch (player.CharacterClass.Trim())
        {
            case "Warrior": baseDmg += 1; break;
            case "Mage":    baseDmg += 2; break;
            case "Rogue":   baseDmg += (Rng.NextDouble() < 0.2) ? 4 : 0; break;
        }

        return Math.Max(1, baseDmg + roll);
    }

    // Handles the player's special ability depending on class.
    static int UseClassSpecial(int enemyDef, bool vsBoss)
    {
        if (player == null) return 0;
        int specialDmg = 0;

        if (player.CharacterClass == "Warrior")
        {
            Console.WriteLine("Warrior uses Heavy Strike!");
            specialDmg = Math.Max(2, player.Attack + 3 - enemyDef);
            ApplyDamageToPlayer(2); // Warrior takes a little self damage.
        }
        else if (player.CharacterClass == "Mage")
        {
            if (player.Gold >= 3)
            {
                Console.WriteLine("Mage casts Fireball!");
                player.Gold -= 3;
                specialDmg = Math.Max(3, player.Attack + 5 - (enemyDef / 2));
            }
            else
            {
                Console.WriteLine("Not enough gold to cast Fireball (costs 3).");
            }
        }
        else if (player.CharacterClass == "Rogue")
        {
            if (Rng.NextDouble() < 0.5)
            {
                Console.WriteLine("Rogue lands a Backstab!");
                specialDmg = Math.Max(4, player.Attack + 6);
            }
            else
            {
                Console.WriteLine("Backstab failed!");
                specialDmg = 1;
            }
        }

        // Special abilities deal 20% less damage against the boss.
        if (vsBoss) specialDmg = (int)Math.Round(specialDmg * 0.8);

        return Math.Max(0, specialDmg);
    }

    // Takes Character (base class) instead of Enemy - polymorphism.
    // enemy.DealDamage() automatically calls the correct override.
    static int CalculateEnemyDamage(Character enemy)
    {
        if (player == null) return 0;
        int roll = Rng.Next(0, 3);
        int baseDmg = enemy.DealDamage();
        int dmg = Math.Max(1, baseDmg - (player.Defense / 2)) + roll;

        // 10% chance the enemy misses and deals slightly less damage.
        if (Rng.NextDouble() < 0.1)
        {
            dmg = Math.Max(1, dmg - 2);
        }

        return dmg;
    }

    static void ApplyDamageToPlayer(int dmg)
    {
        if (player == null) return;
        player.TakeDamage(dmg);
    }

    static void UsePotion()
    {
        if (player == null) return;
        if (player.Potions <= 0)
        {
            Console.WriteLine("You have no potions left.");
            return;
        }

        int heal = 12;
        int oldHealth = player.Health;

        // Using the IHealable interface to heal the player.
        IHealable healable = player;
        healable.Heal(heal);

        player.Potions--;
        Console.WriteLine($"You drink a potion and recover {player.Health - oldHealth} HP.");
    }

    // Escape chance varies by class. Rogue is best at running away.
    static bool TryRunAway()
    {
        if (player == null) return false;
        double chance = 0.25;
        if (player.CharacterClass == "Rogue") chance = 0.5;
        if (player.CharacterClass == "Mage")  chance = 0.35;
        return Rng.NextDouble() < chance;
    }

    static bool IsPlayerDead()
    {
        return player == null || player.Health <= 0;
    }

    static void AddPlayerXp(int amount)
    {
        if (player == null) return;
        player.Experience += amount;
        MaybeLevelUp();
    }

    static void AddPlayerGold(int amount)
    {
        if (player == null) return;
        player.Gold += amount;
    }

    // Checks if the player should level up after gaining XP.
    static void MaybeLevelUp()
    {
        if (player == null) return;

        int lvl = player.Level;
        int nextThreshold = lvl == 1 ? 10 : (lvl == 2 ? 25 : (lvl == 3 ? 45 : lvl * 20));

        if (player.Experience >= nextThreshold)
        {
            player.Level++;

            switch (player.CharacterClass)
            {
                case "Warrior": player.MaxHealth += 6; player.Attack += 2; player.Defense += 2; break;
                case "Mage":    player.MaxHealth += 4; player.Attack += 4; player.Defense += 1; break;
                case "Rogue":   player.MaxHealth += 5; player.Attack += 3; player.Defense += 1; break;
                default:        player.MaxHealth += 4; player.Attack += 3; player.Defense += 1; break;
            }

            player.SetHealth(player.MaxHealth);
            Console.WriteLine($"You reached level {player.Level}! Stats increased and HP restored.");
        }
    }

    // 35% chance an item drops after combat.
    static void MaybeDropLoot(string enemyName)
    {
        if (player == null) return;
        if (Rng.NextDouble() < 0.35)
        {
            string item = enemyName.Contains("Dragon") ? "Dragon Scale" : "Minor Gem";
            player.Inventory.Add(new Item(item));
            Console.WriteLine($"Item found: {item} (added to your bag)");
        }
    }

    // ======= Room Events =======

    static bool DoTreasure()
    {
        if (player == null) return false;

        Console.WriteLine("You find an old chest...");
        if (Rng.NextDouble() < 0.5)
        {
            int gold = Rng.Next(8, 15);
            AddPlayerGold(gold);
            Console.WriteLine($"The chest contains {gold} gold!");
        }
        else
        {
            var items = new[] { "Iron Dagger", "Oak Staff", "Leather Vest", "Healing Herb" };
            string found = items[Rng.Next(items.Length)];
            player.Inventory.Add(new Item(found));
            Console.WriteLine($"You pick up: {found}");
        }

        return true;
    }

    static bool DoShop()
    {
        Console.WriteLine("A travelling merchant offers their wares:");
        while (true)
        {
            if (player == null) return false;
            Console.WriteLine($"Gold: {player.Gold} | Potions: {player.Potions}");
            Console.WriteLine("1) Buy potion (10 gold)");
            Console.WriteLine("2) Buy weapon (+2 ATK) (25 gold)");
            Console.WriteLine("3) Buy armor (+2 DEF) (25 gold)");
            Console.WriteLine("4) Sell all 'Minor Gem' (+5 gold each)");
            Console.WriteLine("5) Leave shop");
            Console.Write("Choice: ");
            var val = (Console.ReadLine() ?? "").Trim();

            if      (val == "1") TryBuy(10, () => player!.Potions  += 1, "You buy a potion.");
            else if (val == "2") TryBuy(25, () => player!.Attack   += 2, "You buy a better weapon.");
            else if (val == "3") TryBuy(25, () => player!.Defense  += 2, "You buy better armor.");
            else if (val == "4") SellMinorGems();
            else if (val == "5") { Console.WriteLine("You say goodbye to the merchant."); break; }
            else Console.WriteLine("The merchant doesn't understand your choice.");
        }

        return true;
    }

    // Tries to buy something - deducts gold and runs apply() if player can afford it.
    static void TryBuy(int cost, Action apply, string successMsg)
    {
        if (player == null) return;
        if (player.Gold >= cost)
        {
            player.Gold -= cost;
            apply();
            Console.WriteLine(successMsg);
        }
        else
        {
            Console.WriteLine("You can't afford that.");
        }
    }

    static void SellMinorGems()
    {
        if (player == null) return;

        int count = player.Inventory.Count(x => x.Name == "Minor Gem");
        if (count == 0)
        {
            Console.WriteLine("No 'Minor Gem' in your bag.");
            return;
        }

        player.Inventory = player.Inventory.Where(x => x.Name != "Minor Gem").ToList();
        AddPlayerGold(count * 5);
        Console.WriteLine($"You sell {count} Minor Gem(s) for {count * 5} gold.");
    }

    static bool DoRest()
    {
        if (player == null) return false;
        Console.WriteLine("You set up camp and rest.");
        player.SetHealth(player.MaxHealth);
        Console.WriteLine("HP restored to max.");
        return true;
    }

    // ======= Status =======

    static void ShowStatus()
    {
        if (player == null) return;
        Console.WriteLine(
            $"[{player.Name} | {player.CharacterClass}]  HP {player.Health}/{player.MaxHealth}  ATK {player.Attack}  DEF {player.Defense}  LVL {player.Level}  XP {player.Experience}  Gold {player.Gold}  Potions {player.Potions}"
        );
        if (player.Inventory.Count > 0)
        {
            Console.WriteLine("Bag: " + string.Join(", ", player.Inventory.Select(i => i.Name)));
        }
    }
}