namespace HeroFight;

// Warrior: tanky class with high defense and a hard-hitting special.
// Takes self damage when using Heavy Strike.
public class Warrior : Player
{
    public Warrior()
    {
        CharacterClass = "Warrior";
        MaxHealth = 40;
        Attack = 7;
        Defense = 5;
        Potions = 2;
        Gold = 15;
    }

    // Warrior gets a flat +1 damage bonus.
    public override int GetDamageBonus(Random rng) => 1;

    // Heavy Strike: high damage but deals 2 self damage.
    public override int UseSpecial(int enemyDef, bool vsBoss, Random rng)
    {
        Console.WriteLine("Warrior uses Heavy Strike!");
        int dmg = Math.Max(2, Attack + 3 - enemyDef);
        TakeDamage(2);
        Console.WriteLine("You take 2 self damage from the heavy swing.");
        return vsBoss ? (int)Math.Round(dmg * 0.8) : dmg;
    }
}