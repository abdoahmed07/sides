namespace HeroFight;

// Represents an item in the player's inventory.
public class Item
{
    public string Name { get; set; }

    public Item(string name)
    {
        Name = name;
    }
}