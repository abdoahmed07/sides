namespace OBP200_RolePlayingGame;

// Representerar ett föremål i spelarens inventarie.
public class Item
{
    public string Name { get; set; }

    public Item(string name)
    {
        Name = name;
    }
}