# Week 5 — Trees and recursion
# Most tree problems are solved by thinking recursively: solve for the root,
# trust that the recursive calls solve for left and right subtrees

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


# ---- Problem: Maximum Depth of Binary Tree ----
# Depth = 1 + max(depth of left subtree, depth of right subtree)
# Base case: None has depth 0

def max_depth(root: TreeNode) -> int:
    if not root:
        return 0
    return 1 + max(max_depth(root.left), max_depth(root.right))


# ---- Problem: Validate Binary Search Tree ----
# A BST is valid if every node in the left subtree is < node.val
# and every node in the right subtree is > node.val
# The key mistake people make: checking only immediate children, not the whole subtree
# The fix: pass down the valid range [min_val, max_val] as we recurse

def is_valid_bst(root: TreeNode) -> bool:
    def validate(node, min_val, max_val):
        if not node:
            return True
        if not (min_val < node.val < max_val):
            return False
        return (validate(node.left, min_val, node.val) and
                validate(node.right, node.val, max_val))

    return validate(root, float('-inf'), float('inf'))


# ---- Problem: Level Order Traversal ----
# Return nodes level by level as a list of lists
# BFS with a queue — process level-by-level, track level boundaries

from collections import deque

def level_order(root: TreeNode) -> list[list[int]]:
    if not root:
        return []

    result = []
    queue = deque([root])

    while queue:
        level_size = len(queue)  # how many nodes are in the current level
        level = []

        for _ in range(level_size):
            node = queue.popleft()
            level.append(node.val)
            if node.left:  queue.append(node.left)
            if node.right: queue.append(node.right)

        result.append(level)

    return result


# Quick tests
if __name__ == "__main__":
    # Tree:      3
    #           / \
    #          9  20
    #            /  \
    #           15   7
    root = TreeNode(3, TreeNode(9), TreeNode(20, TreeNode(15), TreeNode(7)))
    assert max_depth(root) == 3
    print("Max Depth: OK")

    # Valid BST:    2
    #             / \
    #            1   3
    bst = TreeNode(2, TreeNode(1), TreeNode(3))
    assert is_valid_bst(bst) == True
    # Invalid: 5 is in right subtree of 3 but 5 > 6 is false with range constraint
    invalid = TreeNode(5, TreeNode(1), TreeNode(4, TreeNode(3), TreeNode(6)))
    assert is_valid_bst(invalid) == False
    print("Validate BST: OK")

    assert level_order(root) == [[3], [9, 20], [15, 7]]
    print("Level Order: OK")
