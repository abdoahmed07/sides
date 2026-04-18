namespace HeroFight;

// Abstract base class for all player types (Warrior, Mage, Rogue).
// Each subclass defines its own special ability, damage bonus, and escape chance.
public abstract class Player : Character, IHealable
{
    public string? CharacterClass { get; set; }
    public int MaxHealth { get; set; }
    public int Gold { get; set; }
    public int Experience { get; set; }
    public int Level { get; set; }
    public int Potions { get; set; }
    public List<Item> Inventory { get; set; } = new();

    // Base attack returns Attack + 2 for all player types.
    public override int DealDamage()
    {
        return Attack + 2;
    }

    // Heals but never exceeds MaxHealth.
    public override void Heal(int amount)
    {
        SetHealth(Math.Min(Health + amount, MaxHealth));
    }

    // Each class adds its own damage bonus (crit, flat bonus, etc).
    public abstract int GetDamageBonus(Random rng);

    // Each class has its own special ability.
    public abstract int UseSpecial(int enemyDef, bool vsBoss, Random rng);

    // Base escape chance - overridden by classes that are better at fleeing.
    public virtual double EscapeChance => 0.25;
}