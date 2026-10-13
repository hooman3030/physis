Loading older messages…
whats gist or codespace? is it a good idea for my project?
For physis, neither Gists nor Codespaces is essential right now. They solve different problems, and one might become useful later.

What are they?
What is a GitHub Gist? | Learn Version Control with Git
📝 GitHub Gist
A small, shareable Git repository for code snippets, notes, and individual files.

Useful for physis? Probably not. Keep your project notes, shaders, experiments, and architecture decisions inside the main repository so your AI agents can find them.

Example: sharing a standalone GLSL shader with someone.

Explore Gists

Developing in a codespace - GitHub Docs
☁️ GitHub Codespaces
A cloud-hosted development environment with an editor, terminal, and configurable tools. It can run your project without installing the full development stack locally.

Useful for physis? Potentially, but not as your primary setup. You're planning to develop on your MacBook and run the artwork on your Linux presentation laptop.

Example: opening physis in a browser and running a development server on a remote machine.

Explore Codespaces

Where Codespaces fits into your architecture
MacBook

Primary development · editor · AI coding agents

GitHub repository

Source code · issues · decisions · version history

Linux laptop

Runs the artwork locally

Codespace

Optional cloud development

Codespaces is an alternative place to develop, not a replacement for GitHub itself. It also isn't the same as hosting the finished artwork: a Codespace is a development environment, not a permanent production host.

My recommendation
Feature

Decision for physis

GitHub repository

Essential

GitHub Projects and Issues

Recommended

Gists

Skip for now

Codespaces

Optional; try later if needed

Local MacBook development

Primary setup

Linux presentation laptop

Local runtime and testing

One caveat: Codespaces has usage quotas and can incur charges depending on your plan and usage. Check the
Codespaces billing documentation
before using it regularly.

Bottom line: Keep development on your MacBook, track everything in GitHub, and reserve the old Linux laptop for running physis. Add Codespaces only if you later need a reproducible cloud environment or want to develop from another device.

what project template to choose?
Choose Board for physis development in GitHub Projects.

Template: Team backlog (if available) or a basic Board

View: Board grouped by Status

Fields: Status, Priority, Area

Automation: Enable automatic status updates for pull requests if available

Keep it simple. You're building an evolving art system, not managing a 40-person engineering department.

If GitHub offers templates like Team backlog, Kanban, and Roadmap, choose Team backlog if you want built-in planning fields, otherwise Board is the cleanest starting point. You can add a roadmap view later.

i chose board
Next, configure the physis board like this.

1. Set up your fields
   Keep the default Status field. Add these two custom fields:

Priority — single select: Critical, High, Medium, Low

Area — single select: Engine, Rendering, AI, API, Infrastructure, Art, Documentation

Don't add more fields yet. Complexity is an invasive species.

2. Create your first issues
   Open your physis repository → Issues → New issue.

Define project vision and principles

Area: Documentation · Priority: High

Write down what physis is, what it should become, and its artistic constraints.

Define initial system architecture

Area: Engine · Priority: High

Document the seed, persistent state, evolution loop, rendering, and control API.

Establish development environment

Area: Infrastructure · Priority: High

Set up the MacBook workflow, runtime, tests, and local execution on Linux.

3. Add your first milestone
   In the repository, open Issues → Milestones and create:

M0 — Foundation

Description: Establish project principles, document the initial architecture, and prepare the development environment.

4. Connect the board to the repository
   If you haven't already:

Open your GitHub Project.

Open the project menu and go to Settings.

Find Manage access or Linked repositories (the wording may vary).

Link physis.

Add the issues to your board and set their status to Todo or the equivalent in your default workflow.

One important rule: use issues for actionable tasks, and docs/decisions/ for durable architectural decisions. Don't turn every thought into a ticket.

Next, I'd establish the repository's AGENTS.md and decision-record template before letting coding agents make substantial changes.

in the repo i cant select my projects fields, only labels and link the project
That's expected. GitHub has two separate systems here, because apparently one layer of abstraction wasn't enough.

Repository Issues have labels, assignees, milestones, etc.

GitHub Projects have custom fields such as Priority, Area, and their own Status.

You don't configure Project fields from the repository's issue form.

How to set it up
Open your physis development project.

Create or open an issue card directly in the Project.

Set its Status, Priority, and Area in the project table.

If you create issues in the repository instead, add them to the Project afterward, then set the project fields there.

Recommended division
GitHub feature

Use it for

Labels

bug, enhancement, research, documentation

Project Status

Backlog, Todo, In Progress, Done

Project Priority

Critical, High, Medium, Low

Project Area

Engine, Rendering, AI, API, Infrastructure, Art

Milestones

Major outcomes such as M0 — Foundation

Important: Project fields are metadata on the Project item, not repository issue fields. You can automate synchronization later if needed, but you don't need that complexity now.

For physis, I'd use labels for the kind of work and Project fields for its planning state.

im on silicon, suggest another program (brew)
For Apple Silicon, I'd use GitHub CLI (gh) via Homebrew. It lets you manage repositories, issues, pull requests, and GitHub Projects from your terminal — handy for AI-assisted development.

brew install gh
gh auth login

For a graphical Git client instead, my recommendation is GitHub Desktop:

brew install --cask github

It supports Apple Silicon and makes commits, branches, and syncing straightforward.

My pick for physis: GitHub Desktop for visual Git management, plus gh when you want to automate issue and repository workflows.
