# Week 1 LeetCode warmup — the classic easy problems
# Solving these before the first Pramp session to get comfortable with the interview format

# ---- Problem 1: Two Sum ----
# Given an array of integers and a target, return indices of the two numbers that add to target
# My first instinct was to do nested loops (O(n^2)) but the hash map approach is much cleaner
# Key insight: for each number, the complement (target - num) either exists already or we store num for later

def two_sum(nums: list[int], target: int) -> list[int]:
    # Map from value -> index, built as we go
    seen = {}

    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i

    return []  # problem guarantees a solution exists, but good to handle this


# ---- Problem 2: Valid Parentheses ----
# Given a string of brackets, return True if they're properly nested and closed
# Stack is the natural data structure here — when I see an open bracket I push,
# when I see a close bracket I check if the top of the stack matches

def is_valid(s: str) -> bool:
    stack = []
    # Map closing brackets to their matching openers
    matching = {')': '(', ']': '[', '}': '{'}

    for char in s:
        if char in '([{':
            stack.append(char)
        elif char in ')]}':
            # Stack must be non-empty and the top must be the matching opener
            if not stack or stack[-1] != matching[char]:
                return False
            stack.pop()

    # If the stack is empty, all brackets were matched
    return len(stack) == 0


# ---- Problem 3: Reverse Linked List ----
# Return the head of the reversed list
# The in-place approach uses three pointers: prev, curr, next
# I had to draw this out on paper before the code made sense

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def reverse_list(head: ListNode) -> ListNode:
    prev = None
    curr = head

    while curr:
        next_node = curr.next  # save next before we overwrite it
        curr.next = prev       # reverse the pointer
        prev = curr            # advance prev
        curr = next_node       # advance curr

    # When the loop ends, curr is None and prev is the new head
    return prev


# Quick tests
if __name__ == "__main__":
    # Two Sum
    assert two_sum([2, 7, 11, 15], 9) == [0, 1]
    assert two_sum([3, 2, 4], 6) == [1, 2]
    print("Two Sum: OK")

    # Valid Parentheses
    assert is_valid("()[]{}") == True
    assert is_valid("(]") == False
    assert is_valid("{[]}") == True
    print("Valid Parentheses: OK")

    # Reverse Linked List: 1->2->3->4->5 becomes 5->4->3->2->1
    head = ListNode(1, ListNode(2, ListNode(3, ListNode(4, ListNode(5)))))
    new_head = reverse_list(head)
    vals = []
    node = new_head
    while node:
        vals.append(node.val)
        node = node.next
    assert vals == [5, 4, 3, 2, 1]
    print("Reverse Linked List: OK")
