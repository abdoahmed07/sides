namespace HeroFight;

// Enemy inherits from Character.
// Rewards the player with XP and gold after being defeated.
public class Enemy : Character
{
    public int XpReward { get; set; }
    public int GoldReward { get; set; }

    // Enemies deal damage equal to their base Attack stat.
    public override int DealDamage()
    {
        return Attack;
    }
}