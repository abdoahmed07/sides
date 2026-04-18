namespace HeroFight;

// Interface for characters that can be healed.
// Player implements this - enemies do not.
public interface IHealable
{
    void Heal(int amount);
}