// Test-only fixture matching the inspected official CharacterList schema.
export const characterListFixture = {
  account_list: [
    {
      account_id: "test-account",
      character_list: [
        {
          ocid: "test-ocid",
          character_name: "테스트캐릭터",
          world_name: "테스트월드",
          character_class: "비숍",
          character_level: 250,
        },
      ],
    },
  ],
};
