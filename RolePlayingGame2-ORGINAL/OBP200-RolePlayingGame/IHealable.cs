namespace OBP200_RolePlayingGame;

// Interface for characters that can be healed.
// Player implements this - Enemy does not since enemies don't heal.
public interface IHealable
{
    void Heal(int amount);
}