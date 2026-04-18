namespace OBP200_RolePlayingGame;

// Abstract base class for all characters in the game (player and enemies).
// Contains shared properties and methods used by all characters.
public abstract class Character
{
    public string? Name { get; set; }

    // Health has a private setter - encapsulation so only the class itself changes the value directly.
    // From outside, TakeDamage() and SetHealth() are used instead.
    public int Health { get; private set; }

    public int Attack { get; set; }
    public int Defense { get; set; }

    // Abstract method - all subclasses must implement their own version of DealDamage.
    public abstract int DealDamage();

    // Reduces HP by dmg, but never below 0.
    public void TakeDamage(int dmg)
    {
        Health -= Math.Max(0, dmg);
        if (Health < 0) Health = 0;
    }

    // Virtual so subclasses can write their own heal logic if needed.
    public virtual void Heal(int amount)
    {
        SetHealth(Health + amount);
    }

    // Used to set HP from outside, since the Health setter is private.
    public void SetHealth(int value)
    {
        Health = value;
    }
}