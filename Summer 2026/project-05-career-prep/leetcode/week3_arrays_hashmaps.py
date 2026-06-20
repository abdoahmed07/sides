# Week 3 — Arrays and hash maps (medium problems)
# These are the most common interview topics — most medium problems reduce to one of these patterns

# ---- Problem: Group Anagrams ----
# Group strings that are anagrams of each other
# Key insight: two strings are anagrams if their sorted characters are the same
# So I use the sorted string as a hash map key

from collections import defaultdict

def group_anagrams(strs: list[str]) -> list[list[str]]:
    groups = defaultdict(list)

    for s in strs:
        key = tuple(sorted(s))  # "eat" and "tea" both sort to ('a','e','t')
        groups[key].append(s)

    return list(groups.values())


# ---- Problem: Longest Consecutive Sequence ----
# Given an unsorted array, find the length of the longest consecutive sequence
# Brute force is O(n^2) — sort and scan is O(n log n)
# The O(n) trick: use a hash set and only start counting from the beginning of each sequence

def longest_consecutive(nums: list[int]) -> int:
    num_set = set(nums)
    best = 0

    for num in num_set:
        # Only start counting if this is the beginning of a sequence
        # (i.e., num-1 is not in the set)
        if num - 1 not in num_set:
            current = num
            length = 1
            while current + 1 in num_set:
                current += 1
                length += 1
            best = max(best, length)

    return best


# ---- Problem: Top K Frequent Elements ----
# Return the k most frequent elements
# I can sort by frequency (O(n log n)) or use bucket sort (O(n))
# Bucket sort: buckets[frequency] = [elements with that frequency]

def top_k_frequent(nums: list[int], k: int) -> list[int]:
    count = defaultdict(int)
    for num in nums:
        count[num] += 1

    # Bucket sort: bucket index = frequency, value = list of numbers with that frequency
    buckets = [[] for _ in range(len(nums) + 1)]
    for num, freq in count.items():
        buckets[freq].append(num)

    # Collect from highest frequency down until we have k elements
    result = []
    for i in range(len(buckets) - 1, 0, -1):
        for num in buckets[i]:
            result.append(num)
            if len(result) == k:
                return result

    return result


# Quick tests
if __name__ == "__main__":
    assert sorted([sorted(g) for g in group_anagrams(["eat","tea","tan","ate","nat","bat"])]) == \
           sorted([["bat"], ["nat", "tan"], ["ate", "eat", "tea"]])
    print("Group Anagrams: OK")

    assert longest_consecutive([100, 4, 200, 1, 3, 2]) == 4
    assert longest_consecutive([0, 3, 7, 2, 5, 8, 4, 6, 0, 1]) == 9
    print("Longest Consecutive: OK")

    assert set(top_k_frequent([1, 1, 1, 2, 2, 3], 2)) == {1, 2}
    print("Top K Frequent: OK")
