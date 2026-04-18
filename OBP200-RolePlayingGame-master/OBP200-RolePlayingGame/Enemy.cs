namespace OBP200_RolePlayingGame;

// Enemy ärver från Character.
// Har extra egenskaper för belöningar som spelaren får efter strid.
public class Enemy : Character
{
    public int XpReward { get; set; }
    public int GoldReward { get; set; }

    // Fienden gör skada baserat på sin Attack-stat, utan bonus.
    public override int DealDamage()
    {
        return Attack;
    }
}