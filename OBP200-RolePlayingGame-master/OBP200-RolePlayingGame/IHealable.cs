namespace OBP200_RolePlayingGame;

// Interface för karaktärer som kan läkas.
// Player implementerar detta - Enemy gör det inte eftersom fiender inte healar.
public interface IHealable
{
    void Heal(int amount);
}