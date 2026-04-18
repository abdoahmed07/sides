namespace HeroFight;

// Rogue: high crit chance and the best escape rate.
// Backstab is high risk, high reward.
public class Rogue : Player
{
    public Rogue()
    {
        CharacterClass = "Rogue";
        MaxHealth = 32;
        Attack = 8;
        Defense = 3;
        Potions = 3;
        Gold = 20;
    }

    // Rogue has a 20% chance to land a crit (+4 bonus damage).
    public override int GetDamageBonus(Random rng) => rng.NextDouble() < 0.2 ? 4 : 0;

    // Rogue is the best at escaping.
    public override double EscapeChance => 0.5;

    // Backstab: 50% chance of massive damage, otherwise nearly misses.
    public override int UseSpecial(int enemyDef, bool vsBoss, Random rng)
    {
        int dmg;
        if (rng.NextDouble() < 0.5)
        {
            Console.WriteLine("Rogue lands a Backstab!");
            dmg = Math.Max(4, Attack + 6);
        }
        else
        {
            Console.WriteLine("Backstab failed!");
            dmg = 1;
        }
        return vsBoss ? (int)Math.Round(dmg * 0.8) : dmg;
    }
}