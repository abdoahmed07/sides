using HeroFight;
using System.Text;

class Program
{
    static Player? player;

    static List<string[]> Rooms = new List<string[]>();

    // Enemy templates used as base when generating enemies.
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
        Console.WriteLine("=== HeroFight ===");
        Console.WriteLine("1. New Game");
        Console.WriteLine("2. Exit");
    }

    static void StartNewGame()
    {
        Console.Write("Enter your name: ");
        var name = (Console.ReadLine() ?? "").Trim();
        if (string.IsNullOrWhiteSpace(name)) name = "Hero";

        Console.WriteLine("Choose your class:");
        Console.WriteLine("  1) Warrior  - Tanky, steady damage, Heavy Strike special");
        Console.WriteLine("  2) Mage     - High damage, low defense, Fireball special (costs gold)");
        Console.WriteLine("  3) Rogue    - Crit chance, best escape rate, Backstab special");
        Console.Write("Choice: ");
        var k = (Console.ReadLine() ?? "").Trim();

        // Create the correct Player subclass based on choice.
        player = k switch
        {
            "2" => new Mage(),
            "3" => new Rogue(),
            _   => new Warrior()
        };

        player.Name = name;
        player.Experience = 0;
        player.Level = 1;
        player.Inventory = new List<Item>
        {
            new Item("Wooden Sword"),
            new Item("Cloth Armor")
        };
        player.SetHealth(player.MaxHealth);

        Rooms.Clear();
        Rooms.Add(new[] { "battle",   "Forest Path"        });
        Rooms.Add(new[] { "treasure", "Old Chest"          });
        Rooms.Add(new[] { "shop",     "Travelling Merchant" });
        Rooms.Add(new[] { "battle",   "Cave Entrance"      });
        Rooms.Add(new[] { "rest",     "Campfire"           });
        Rooms.Add(new[] { "battle",   "Cave Depths"        });
        Rooms.Add(new[] { "boss",     "The Ancient Dragon" });

        CurrentRoomIndex = 0;

        Console.WriteLine($"\nWelcome, {name} the {player.CharacterClass}!");
        ShowStatus();
    }

    static void RunGameLoop()
    {
        while (true)
        {
            var room = Rooms[CurrentRoomIndex];
            Console.WriteLine($"\n--- Room {CurrentRoomIndex + 1}/{Rooms.Count}: {room[1]} ---");

            bool continueAdventure = EnterRoom(room[0]);

            if (!player!.IsAlive)
            {
                Console.WriteLine("\nYou have fallen... Game over.");
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
                Console.WriteLine("\n*** You have completed the adventure! Congratulations! ***");
                break;
            }

            Console.WriteLine("\n[C] Continue     [Q] Quit to main menu");
            Console.Write("Choice: ");
            var post = (Console.ReadLine() ?? "").Trim().ToUpperInvariant();

            if (post == "Q")
            {
                Console.WriteLine("Back to main menu.");
                break;
            }
        }
    }

    // ======= Room Handling =======

    static bool EnterRoom(string type)
    {
        return type switch
        {
            "battle"   => DoBattle(isBoss: false),
            "boss"     => DoBattle(isBoss: true),
            "treasure" => DoTreasure(),
            "shop"     => DoShop(),
            "rest"     => DoRest(),
            _          => true
        };
    }

    // ======= Combat =======

    static bool DoBattle(bool isBoss)
    {
        // Declared as Character (base class) - polymorphism.
        Character enemy = GenerateEnemy(isBoss);

        Console.WriteLine($"\nA {enemy.Name} appears!");
        Console.WriteLine($"  HP: {enemy.Health}  ATK: {enemy.Attack}  DEF: {enemy.Defense}");

        while (enemy.IsAlive && player!.IsAlive)
        {
            Console.WriteLine();
            ShowStatus();
            ShowEnemyStatus(enemy);
            Console.WriteLine("[A] Attack   [X] Special   [P] Potion   [R] Run");
            if (isBoss) Console.WriteLine("(You cannot run from the boss!)");
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
                // UseSpecial is called polymorphically - correct override runs automatically.
                int special = player.UseSpecial(enemy.Defense, isBoss, Rng);
                enemy.TakeDamage(special);
                if (special > 0)
                    Console.WriteLine($"{enemy.Name} takes {special} damage!");
            }
            else if (cmd == "P")
            {
                UsePotion();
            }
            else if (cmd == "R" && !isBoss)
            {
                if (Rng.NextDouble() < player.EscapeChance)
                {
                    Console.WriteLine("You escaped!");
                    return true;
                }
                Console.WriteLine("Failed to escape!");
            }
            else
            {
                Console.WriteLine("You hesitate...");
            }

            if (!enemy.IsAlive) break;

            // DealDamage() is called polymorphically on the base class.
            int enemyDamage = CalculateEnemyDamage(enemy);
            player.TakeDamage(enemyDamage);
            Console.WriteLine($"{enemy.Name} attacks for {enemyDamage} damage!");
        }

        if (!player!.IsAlive) return false;

        // Cast to Enemy only to retrieve XP and gold rewards.
        if (enemy is Enemy defeated)
        {
            AddPlayerXp(defeated.XpReward);
            AddPlayerGold(defeated.GoldReward);
            Console.WriteLine($"\nVictory! +{defeated.XpReward} XP, +{defeated.GoldReward} gold.");
            MaybeDropLoot(defeated.Name);
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

    static void InitEnemyTemplates()
    {
        var e1 = new Enemy { Name = "Wild Boar",  Attack = 4, Defense = 1, XpReward = 6, GoldReward = 4 };
        e1.SetHealth(18); EnemyTemplates.Add(e1);

        var e2 = new Enemy { Name = "Skeleton",   Attack = 5, Defense = 2, XpReward = 7, GoldReward = 5 };
        e2.SetHealth(20); EnemyTemplates.Add(e2);

        var e3 = new Enemy { Name = "Bandit",     Attack = 6, Defense = 1, XpReward = 8, GoldReward = 6 };
        e3.SetHealth(16); EnemyTemplates.Add(e3);

        var e4 = new Enemy { Name = "Slime",      Attack = 3, Defense = 0, XpReward = 5, GoldReward = 3 };
        e4.SetHealth(14); EnemyTemplates.Add(e4);

        var e5 = new Enemy { Name = "Dark Elf",   Attack = 7, Defense = 2, XpReward = 10, GoldReward = 8 };
        e5.SetHealth(22); EnemyTemplates.Add(e5);
    }

    // Player damage uses GetDamageBonus() - polymorphic, no class checks needed.
    static int CalculatePlayerDamage(int enemyDef)
    {
        if (player == null) return 0;
        int baseDmg = Math.Max(1, player.Attack - (enemyDef / 2));
        int roll = Rng.Next(0, 3);
        baseDmg += player.GetDamageBonus(Rng);
        return Math.Max(1, baseDmg + roll);
    }

    // Takes Character (base class) - DealDamage() runs polymorphically.
    static int CalculateEnemyDamage(Character enemy)
    {
        if (player == null) return 0;
        int roll = Rng.Next(0, 3);
        int dmg = Math.Max(1, enemy.DealDamage() - (player.Defense / 2)) + roll;
        if (Rng.NextDouble() < 0.1) dmg = Math.Max(1, dmg - 2); // glancing blow
        return dmg;
    }

    static void UsePotion()
    {
        if (player == null) return;
        if (player.Potions <= 0) { Console.WriteLine("You have no potions left."); return; }

        int oldHealth = player.Health;

        // Using IHealable interface for healing.
        IHealable healable = player;
        healable.Heal(12);

        player.Potions--;
        Console.WriteLine($"You drink a potion and recover {player.Health - oldHealth} HP.");
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

    static void MaybeLevelUp()
    {
        if (player == null) return;

        int lvl = player.Level;
        int nextThreshold = lvl == 1 ? 10 : (lvl == 2 ? 25 : (lvl == 3 ? 45 : lvl * 20));

        if (player.Experience >= nextThreshold)
        {
            player.Level++;

            // Level up stats differ per class.
            if (player is Warrior) { player.MaxHealth += 6; player.Attack += 2; player.Defense += 2; }
            else if (player is Mage) { player.MaxHealth += 4; player.Attack += 4; player.Defense += 1; }
            else if (player is Rogue) { player.MaxHealth += 5; player.Attack += 3; player.Defense += 1; }
            else { player.MaxHealth += 4; player.Attack += 3; player.Defense += 1; }

            player.SetHealth(player.MaxHealth);
            Console.WriteLine($"\n*** LEVEL UP! You are now level {player.Level}! Stats increased. ***");
        }
    }

    static void MaybeDropLoot(string? enemyName)
    {
        if (player == null) return;
        if (Rng.NextDouble() < 0.35)
        {
            string item = (enemyName ?? "").Contains("Dragon") ? "Dragon Scale" : "Minor Gem";
            player.Inventory.Add(new Item(item));
            Console.WriteLine($"Item dropped: {item} (added to your bag)");
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
            Console.WriteLine($"\nGold: {player.Gold} | Potions: {player.Potions}");
            Console.WriteLine("1) Buy potion       (+1 potion, 10 gold)");
            Console.WriteLine("2) Buy weapon       (+2 ATK,    25 gold)");
            Console.WriteLine("3) Buy armor        (+2 DEF,    25 gold)");
            Console.WriteLine("4) Sell Minor Gems  (+5 gold each)");
            Console.WriteLine("5) Leave shop");
            Console.Write("Choice: ");
            var val = (Console.ReadLine() ?? "").Trim();

            if      (val == "1") TryBuy(10, () => player!.Potions  += 1, "You buy a potion.");
            else if (val == "2") TryBuy(25, () => player!.Attack   += 2, "You buy a better weapon.");
            else if (val == "3") TryBuy(25, () => player!.Defense  += 2, "You buy better armor.");
            else if (val == "4") SellMinorGems();
            else if (val == "5") { Console.WriteLine("Goodbye!"); break; }
            else Console.WriteLine("Invalid choice.");
        }
        return true;
    }

    static void TryBuy(int cost, Action apply, string successMsg)
    {
        if (player == null) return;
        if (player.Gold >= cost) { player.Gold -= cost; apply(); Console.WriteLine(successMsg); }
        else Console.WriteLine("You can't afford that.");
    }

    static void SellMinorGems()
    {
        if (player == null) return;
        int count = player.Inventory.Count(x => x.Name == "Minor Gem");
        if (count == 0) { Console.WriteLine("No Minor Gems in your bag."); return; }
        player.Inventory = player.Inventory.Where(x => x.Name != "Minor Gem").ToList();
        AddPlayerGold(count * 5);
        Console.WriteLine($"Sold {count} Minor Gem(s) for {count * 5} gold.");
    }

    static bool DoRest()
    {
        if (player == null) return false;
        Console.WriteLine("You rest at the campfire...");
        player.SetHealth(player.MaxHealth);
        Console.WriteLine("HP fully restored.");
        return true;
    }

    // ======= Status Display =======

    static void ShowStatus()
    {
        if (player == null) return;
        Console.WriteLine($"[{player.Name} | {player.CharacterClass}]  HP {player.Health}/{player.MaxHealth}  ATK {player.Attack}  DEF {player.Defense}  LVL {player.Level}  XP {player.Experience}  Gold {player.Gold}  Potions {player.Potions}");
        if (player.Inventory.Count > 0)
            Console.WriteLine("Bag: " + string.Join(", ", player.Inventory.Select(i => i.Name)));
    }

    static void ShowEnemyStatus(Character enemy)
    {
        // Simple HP bar
        int barLength = 20;
        int filled = (int)Math.Round((double)enemy.Health / 55 * barLength);
        filled = Math.Clamp(filled, 0, barLength);
        string bar = new string('#', filled) + new string('-', barLength - filled);
        Console.WriteLine($"{enemy.Name}: HP {enemy.Health} [{bar}]");
    }
}