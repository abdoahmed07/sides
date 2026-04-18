namespace OBP200_RolePlayingGame;

// Player ärver från Character och implementerar IHealable.
// Har extra egenskaper som guld, nivå och inventarie som bara spelare behöver.
public class Player : Character, IHealable
{
    public string CharacterClass { get; set; }
    public int MaxHealth { get; set; }
    public int Gold { get; set; }
    public int Experience { get; set; }
    public int Level { get; set; }
    public int Potions { get; set; }
    public List<Item> Inventory { get; set; } = new();

    // Spelaren gör lite mer skada än basattacken.
    public override int DealDamage()
    {
        return Attack + 2;
    }

    // Healar spelaren men får aldrig överstiga MaxHealth.
    public override void Heal(int amount)
    {
        SetHealth(Math.Min(Health + amount, MaxHealth));
    }
}