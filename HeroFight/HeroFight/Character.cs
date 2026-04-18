namespace HeroFight;

// Abstract base class for all characters (player and enemies).
// Shared properties and methods used by everyone.
public abstract class Character
{
    public string? Name { get; set; }

    // Private setter - only changed through TakeDamage(), Heal(), SetHealth().
    public int Health { get; private set; }

    public int Attack { get; set; }
    public int Defense { get; set; }

    // Each subclass defines how much damage they deal.
    public abstract int DealDamage();

    // Reduces HP but never below 0.
    public void TakeDamage(int dmg)
    {
        Health -= Math.Max(0, dmg);
        if (Health < 0) Health = 0;
    }

    // Virtual so subclasses can override with their own heal logic.
    public virtual void Heal(int amount)
    {
        SetHealth(Health + amount);
    }

    // Used to set HP from outside since the setter is private.
    public void SetHealth(int value)
    {
        Health = value;
    }

    public bool IsAlive => Health > 0;
}