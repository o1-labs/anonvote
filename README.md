Anonvote
========

A centralized anonymous voting SNAPP (SNARK App) implemented using [Snarky](https://github.com/o1-labs/snarky). Anonvote allows anonymous users to vote on elections in a way that prevents other participants on the network (including the centralized server that connects the network together) from identifying other voters. Voters are able to create elections, restrict who can vote in elections (for instance, create an election only women can participate in), and tally the results of any election, whether they were the creator or not.

### Architecture

An Anonvote network consists of a single registrar and a series of voters. Initially, voters connect to the registrar and register a commitment to their voter record. Note that the actual contents of the voter record are not shared with the registrar. Once all the voters who will participate in elections have registered, the registrar closes registration, and voters can begin creating elections and casting votes. In order to cast votes, voters must request a membership proof from the registrar, which, as the name implies, proves that a voter is a valid registered voter. The registrar tracks elections and votes created/cast by voters and synchronizes this information across all voters connected to the network. To cast a vote, a voter generates a SNARK that certifies that they are a registered voter and that they are allowed to vote in the election. Along with that, they commit to a unique value (called a nullifier) which the registrar and other voters can use to determine whether or not a voter attempted to cast multiple ballots for the same election. As the registrar and voters on the network receive votes, they verify the SNARK, check the nullifier to ensure the vote is not a duplicate, and update their tally for that election.

Under the current implementation, voters connect to the registrar via a websocket server. The voter and registrar clients are implemented in javascript and communicate to an SNARK external process built with Snarky and ReasonML in order to generate and verify SNARK proofs.

### How to use

1. Start the registrar using `npm run registrar`.
2. Connect however many voters you wish to the registrar using `npm run voter -- <voter json file> <registrar uri>`. The voter json file contains the voter record you wish to commit to (examples are `sample_voters/`). The registrar uri is optional and defaults to `localhost:8080`, the same as the default port for the registrar.
3. Once ready, issue the `close` command to the registrar to close registration.
4. Voters can now create elections, cast votes, and tally results. See [Commands](#commands) for details.

### Commands
[commands]: #commands

##### Registrar

| Command               | Description              |
|-----------------------|--------------------------|
| `close`               | close registration       |
| `list`                | list available elections |
| `tally <election-id>` | tally an election        |
| `exit`                | exit the program         |

##### Voter

| Command                                       | Description                                                                |
|-----------------------------------------------|----------------------------------------------------------------------------|
| `create <summary> <attribute-constraints>...` | create an election (attribute constraints are of the form `<key>=<value>`) |
| `list`                                        | list available elections                                                   |
| `tally <election-id>`                         | tally an election                                                          |
| `vote <election-id> <Y/N>`                    | vote yes or no on an election                                              |
| `exit`                                        | exit the program                                                           |
