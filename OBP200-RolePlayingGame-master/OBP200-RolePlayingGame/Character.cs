namespace OBP200_RolePlayingGame;

// Abstrakt basklass för alla karaktärer i spelet (spelare och fiender).
// Innehåller gemensamma egenskaper och metoder som delas av alla karaktärer.
public abstract class Character
{
    public string Name { get; set; }

    // Health är privat setter - inkapsling så att bara klassen själv ändrar värdet direkt.
    // Utifrån används TakeDamage() och SetHealth() istället.
    public int Health { get; private set; }

    public int Attack { get; set; }
    public int Defense { get; set; }

    // Abstrakt metod - alla subklasser måste implementera sin egen version av DealDamage.
    public abstract int DealDamage();

    // Minskar HP med dmg, men aldrig under 0.
    public void TakeDamage(int dmg)
    {
        Health -= Math.Max(0, dmg);
        if (Health < 0) Health = 0;
    }

    // Virtual så att subklasser kan skriva sin egen heal-logik om de behöver det.
    public virtual void Heal(int amount)
    {
        SetHealth(Health + amount);
    }

    // Används för att sätta HP utifrån, eftersom Health-settern är privat.
    public void SetHealth(int value)
    {
        Health = value;
    }
}