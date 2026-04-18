using System.Text;

namespace OBP200_RolePlayingGame;

class Program
{
    // Spelaren lagras som Player-objekt istället för en string-array.
    static Player? player;

    static List<string[]> Rooms = new List<string[]>();

    // Fiendemallar som används som bas när fiender skapas.
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
            Console.Write("Välj: ");
            var choice = (Console.ReadLine() ?? "").Trim();

            if (choice == "1")
            {
                StartNewGame();
                RunGameLoop();
            }
            else if (choice == "2")
            {
                Console.WriteLine("Avslutar...");
                return;
            }
            else
            {
                Console.WriteLine("Ogiltigt val.");
            }

            Console.WriteLine();
        }
    }

    // ======= Meny & Init =======

    static void ShowMainMenu()
    {
        Console.WriteLine("=== Text-RPG ===");
        Console.WriteLine("1. Nytt spel");
        Console.WriteLine("2. Avsluta");
    }

    static void StartNewGame()
    {
        Console.Write("Ange namn: ");
        var name = (Console.ReadLine() ?? "").Trim();
        if (string.IsNullOrWhiteSpace(name)) name = "Namnlös";

        Console.WriteLine("Välj klass: 1) Warrior  2) Mage  3) Rogue");
        Console.Write("Val: ");
        var k = (Console.ReadLine() ?? "").Trim();

        string cls = "Warrior";
        int hp = 0, maxhp = 0, atk = 0, def = 0;
        int potions = 0, gold = 0;

        switch (k)
        {
            case "1": // Warrior: tankig
                cls = "Warrior"; maxhp = 40; hp = 40; atk = 7; def = 5; potions = 2; gold = 15;
                break;
            case "2": // Mage: hög damage, låg def
                cls = "Mage"; maxhp = 28; hp = 28; atk = 10; def = 2; potions = 2; gold = 15;
                break;
            case "3": // Rogue: krit-chans
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

        Rooms.Clear();
        Rooms.Add(new[] { "battle",   "Skogsstig"        });
        Rooms.Add(new[] { "treasure", "Gammal kista"     });
        Rooms.Add(new[] { "shop",     "Vandrande köpman" });
        Rooms.Add(new[] { "battle",   "Grottans mynning" });
        Rooms.Add(new[] { "rest",     "Lägereld"         });
        Rooms.Add(new[] { "battle",   "Grottans djup"    });
        Rooms.Add(new[] { "boss",     "Urdraken"         });

        CurrentRoomIndex = 0;

        Console.WriteLine($"Välkommen, {name} the {cls}!");
        ShowStatus();
    }

    static void RunGameLoop()
    {
        while (true)
        {
            var room = Rooms[CurrentRoomIndex];
            Console.WriteLine($"--- Rum {CurrentRoomIndex + 1}/{Rooms.Count}: {room[1]} ({room[0]}) ---");

            bool continueAdventure = EnterRoom(room[0]);

            if (IsPlayerDead())
            {
                Console.WriteLine("Du har stupat... Spelet över.");
                break;
            }

            if (!continueAdventure)
            {
                Console.WriteLine("Du lämnar äventyret för nu.");
                break;
            }

            CurrentRoomIndex++;

            if (CurrentRoomIndex >= Rooms.Count)
            {
                Console.WriteLine();
                Console.WriteLine("Du har klarat äventyret!");
                break;
            }

            Console.WriteLine();
            Console.WriteLine("[C] Fortsätt     [Q] Avsluta till huvudmeny");
            Console.Write("Val: ");
            var post = (Console.ReadLine() ?? "").Trim().ToUpperInvariant();

            if (post == "Q")
            {
                Console.WriteLine("Tillbaka till huvudmenyn.");
                break;
            }

            Console.WriteLine();
        }
    }

    // ======= Rumshantering =======

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
                Console.WriteLine("Du vandrar vidare...");
                return true;
        }
    }

    // ======= Strid =======

    static bool DoBattle(bool isBoss)
    {
        // enemy deklareras som basklassen Character - polymorfism.
        Character enemy = GenerateEnemy(isBoss);

        Console.WriteLine($"En {enemy.Name} dyker upp! (HP {enemy.Health}, ATK {enemy.Attack}, DEF {enemy.Defense})");

        while (enemy.Health > 0 && !IsPlayerDead())
        {
            Console.WriteLine();
            ShowStatus();
            Console.WriteLine($"Fiende: {enemy.Name} HP={enemy.Health}");
            Console.WriteLine("[A] Attack   [X] Special   [P] Dryck   [R] Fly");
            if (isBoss) Console.WriteLine("(Du kan inte fly från en boss!)");
            Console.Write("Val: ");

            var cmd = (Console.ReadLine() ?? "").Trim().ToUpperInvariant();

            if (cmd == "A")
            {
                int damage = CalculatePlayerDamage(enemy.Defense);
                enemy.TakeDamage(damage);
                Console.WriteLine($"Du slog {enemy.Name} för {damage} skada.");
            }
            else if (cmd == "X")
            {
                int special = UseClassSpecial(enemy.Defense, isBoss);
                enemy.TakeDamage(special);
                Console.WriteLine($"Special! {enemy.Name} tar {special} skada.");
            }
            else if (cmd == "P")
            {
                UsePotion();
            }
            else if (cmd == "R" && !isBoss)
            {
                if (TryRunAway())
                {
                    Console.WriteLine("Du flydde!");
                    return true;
                }
                else
                {
                    Console.WriteLine("Misslyckad flykt!");
                }
            }
            else
            {
                Console.WriteLine("Du tvekar...");
            }

            if (enemy.Health <= 0) break;

            // Fiendens attack - DealDamage() körs polymorfiskt.
            int enemyDamage = CalculateEnemyDamage(enemy);
            ApplyDamageToPlayer(enemyDamage);
            Console.WriteLine($"{enemy.Name} anfaller och gör {enemyDamage} skada!");
        }

        if (IsPlayerDead()) return false;

        // Cast till Enemy för att hämta XP och guld.
        if (enemy is Enemy defeatedEnemy)
        {
            AddPlayerXp(defeatedEnemy.XpReward);
            AddPlayerGold(defeatedEnemy.GoldReward);
            Console.WriteLine($"Seger! +{defeatedEnemy.XpReward} XP, +{defeatedEnemy.GoldReward} guld.");
            MaybeDropLoot(defeatedEnemy.Name);
        }

        return true;
    }

    static Enemy GenerateEnemy(bool isBoss)
    {
        if (isBoss)
        {
            var boss = new Enemy { Name = "Urdraken", Attack = 9, Defense = 4, XpReward = 30, GoldReward = 50 };
            boss.SetHealth(55);
            return boss;
        }
        else
        {
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

    static void InitEnemyTemplates()
    {
        var e1 = new Enemy { Name = "Vildsvin", Attack = 4, Defense = 1, XpReward = 6, GoldReward = 4 };
        e1.SetHealth(18);
        EnemyTemplates.Add(e1);

        var e2 = new Enemy { Name = "Skelett", Attack = 5, Defense = 2, XpReward = 7, GoldReward = 5 };
        e2.SetHealth(20);
        EnemyTemplates.Add(e2);

        var e3 = new Enemy { Name = "Bandit", Attack = 6, Defense = 1, XpReward = 8, GoldReward = 6 };
        e3.SetHealth(16);
        EnemyTemplates.Add(e3);

        var e4 = new Enemy { Name = "Geléslem", Attack = 3, Defense = 0, XpReward = 5, GoldReward = 3 };
        e4.SetHealth(14);
        EnemyTemplates.Add(e4);
    }

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

    static int UseClassSpecial(int enemyDef, bool vsBoss)
    {
        if (player == null) return 0;
        int specialDmg = 0;

        if (player.CharacterClass == "Warrior")
        {
            Console.WriteLine("Warrior använder Heavy Strike!");
            specialDmg = Math.Max(2, player.Attack + 3 - enemyDef);
            ApplyDamageToPlayer(2);
        }
        else if (player.CharacterClass == "Mage")
        {
            if (player.Gold >= 3)
            {
                Console.WriteLine("Mage kastar Fireball!");
                player.Gold -= 3;
                specialDmg = Math.Max(3, player.Attack + 5 - (enemyDef / 2));
            }
            else
            {
                Console.WriteLine("Inte tillräckligt med guld för att kasta Fireball (kostar 3).");
            }
        }
        else if (player.CharacterClass == "Rogue")
        {
            if (Rng.NextDouble() < 0.5)
            {
                Console.WriteLine("Rogue utför en lyckad Backstab!");
                specialDmg = Math.Max(4, player.Attack + 6);
            }
            else
            {
                Console.WriteLine("Backstab misslyckades!");
                specialDmg = 1;
            }
        }

        if (vsBoss) specialDmg = (int)Math.Round(specialDmg * 0.8);

        return Math.Max(0, specialDmg);
    }

    // Tar emot Character (basklassen) och anropar DealDamage() polymorfiskt.
    static int CalculateEnemyDamage(Character enemy)
    {
        if (player == null) return 0;
        int roll = Rng.Next(0, 3);
        int baseDmg = enemy.DealDamage();
        int dmg = Math.Max(1, baseDmg - (player.Defense / 2)) + roll;

        if (Rng.NextDouble() < 0.1) dmg = Math.Max(1, dmg - 2);

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
            Console.WriteLine("Du har inga drycker kvar.");
            return;
        }

        int heal = 12;
        int oldHealth = player.Health;

        // Använder IHealable-interfacet för att heala spelaren.
        IHealable healable = player;
        healable.Heal(heal);

        player.Potions--;
        Console.WriteLine($"Du dricker en dryck och återfår {player.Health - oldHealth} HP.");
    }

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
            Console.WriteLine($"Du når nivå {player.Level}! Värden ökade och HP återställd.");
        }
    }

    static void MaybeDropLoot(string enemyName)
    {
        if (player == null) return;
        if (Rng.NextDouble() < 0.35)
        {
            string item = enemyName.Contains("Urdraken") ? "Dragon Scale" : "Minor Gem";
            player.Inventory.Add(new Item(item));
            Console.WriteLine($"Föremål hittat: {item} (lagt i din väska)");
        }
    }

    // ======= Rumshändelser =======

    static bool DoTreasure()
    {
        if (player == null) return false;
        Console.WriteLine("Du hittar en gammal kista...");
        if (Rng.NextDouble() < 0.5)
        {
            int gold = Rng.Next(8, 15);
            AddPlayerGold(gold);
            Console.WriteLine($"Kistan innehåller {gold} guld!");
        }
        else
        {
            var items = new[] { "Iron Dagger", "Oak Staff", "Leather Vest", "Healing Herb" };
            string found = items[Rng.Next(items.Length)];
            player.Inventory.Add(new Item(found));
            Console.WriteLine($"Du plockar upp: {found}");
        }
        return true;
    }

    static bool DoShop()
    {
        Console.WriteLine("En vandrande köpman erbjuder sina varor:");
        while (true)
        {
            if (player == null) return false;
            Console.WriteLine($"Guld: {player.Gold} | Drycker: {player.Potions}");
            Console.WriteLine("1) Köp dryck (10 guld)");
            Console.WriteLine("2) Köp vapen (+2 ATK) (25 guld)");
            Console.WriteLine("3) Köp rustning (+2 DEF) (25 guld)");
            Console.WriteLine("4) Sälj alla 'Minor Gem' (+5 guld/st)");
            Console.WriteLine("5) Lämna butiken");
            Console.Write("Val: ");
            var val = (Console.ReadLine() ?? "").Trim();

            if      (val == "1") TryBuy(10, () => player!.Potions  += 1, "Du köper en dryck.");
            else if (val == "2") TryBuy(25, () => player!.Attack   += 2, "Du köper ett bättre vapen.");
            else if (val == "3") TryBuy(25, () => player!.Defense  += 2, "Du köper bättre rustning.");
            else if (val == "4") SellMinorGems();
            else if (val == "5") { Console.WriteLine("Du säger adjö till köpmannen."); break; }
            else Console.WriteLine("Köpmannen förstår inte ditt val.");
        }
        return true;
    }

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
            Console.WriteLine("Du har inte råd.");
        }
    }

    static void SellMinorGems()
    {
        if (player == null) return;
        int count = player.Inventory.Count(x => x.Name == "Minor Gem");
        if (count == 0) { Console.WriteLine("Inga 'Minor Gem' i väskan."); return; }
        player.Inventory = player.Inventory.Where(x => x.Name != "Minor Gem").ToList();
        AddPlayerGold(count * 5);
        Console.WriteLine($"Du säljer {count} st Minor Gem för {count * 5} guld.");
    }

    static bool DoRest()
    {
        if (player == null) return false;
        Console.WriteLine("Du slår läger och vilar.");
        player.SetHealth(player.MaxHealth);
        Console.WriteLine("HP återställt till max.");
        return true;
    }

    // ======= Status =======

    static void ShowStatus()
    {
        if (player == null) return;
        Console.WriteLine(
            $"[{player.Name} | {player.CharacterClass}]  HP {player.Health}/{player.MaxHealth}  ATK {player.Attack}  DEF {player.Defense}  LVL {player.Level}  XP {player.Experience}  Guld {player.Gold}  Drycker {player.Potions}"
        );
        if (player.Inventory.Count > 0)
            Console.WriteLine("Väska: " + string.Join(", ", player.Inventory.Select(i => i.Name)));
    }
}