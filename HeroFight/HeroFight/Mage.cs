namespace HeroFight;

// Mage: high damage but fragile. Fireball costs gold.
// Better escape chance than Warrior.
public class Mage : Player
{
    public Mage()
    {
        CharacterClass = "Mage";
        MaxHealth = 28;
        Attack = 10;
        Defense = 2;
        Potions = 2;
        Gold = 15;
    }

    // Mage gets a flat +2 damage bonus.
    public override int GetDamageBonus(Random rng) => 2;

    // Mage is decent at escaping thanks to teleportation.
    public override double EscapeChance => 0.35;

    // Fireball: high damage but costs 3 gold.
    public override int UseSpecial(int enemyDef, bool vsBoss, Random rng)
    {
        if (Gold < 3)
        {
            Console.WriteLine("Not enough gold to cast Fireball (costs 3).");
            return 0;
        }

        Console.WriteLine("Mage casts Fireball!");
        Gold -= 3;
        int dmg = Math.Max(3, Attack + 5 - (enemyDef / 2));
        return vsBoss ? (int)Math.Round(dmg * 0.8) : dmg;
    }
}