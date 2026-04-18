namespace OBP200_RolePlayingGame;

// Enemy inherits from Character.
// Has extra properties for rewards the player gets after combat.
public class Enemy : Character
{
    public int XpReward { get; set; }
    public int GoldReward { get; set; }

    // The enemy deals damage based on its Attack stat, without bonus.
    public override int DealDamage()
    {
        return Attack;
    }
}