namespace OBP200_RolePlayingGame;

// Player inherits from Character and implements IHealable.
// Has extra properties like gold, level and inventory that only players need.
public class Player : Character, IHealable
{
    public string? CharacterClass { get; set; }
    public int MaxHealth { get; set; }
    public int Gold { get; set; }
    public int Experience { get; set; }
    public int Level { get; set; }
    public int Potions { get; set; }
    public List<Item> Inventory { get; set; } = new();

    // The player deals slightly more damage than the base attack.
    public override int DealDamage()
    {
        return Attack + 2;
    }

    // Heals the player but never exceeds MaxHealth.
    public override void Heal(int amount)
    {
        SetHealth(Math.Min(Health + amount, MaxHealth));
    }
}