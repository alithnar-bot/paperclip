// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectDetail } from "./ProjectDetail";

const navigateMock = vi.fn();
const closePanelMock = vi.fn();
const setBreadcrumbsMock = vi.fn();
const pushToastMock = vi.fn();
const setSelectedCompanyIdMock = vi.fn();

const mockProjectsApi = vi.hoisted(() => ({
  get: vi.fn(async () => ({
    id: "project-1",
    companyId: "company-1",
    urlKey: "project-alpha",
    goalId: null,
    goalIds: [],
    goals: [],
    name: "Project Alpha",
    description: "Factory-ready project",
    status: "in_progress",
    leadAgentId: null,
    targetDate: null,
    color: "#22c55e",
    pauseReason: null,
    pausedAt: null,
    archivedAt: null,
    executionWorkspacePolicy: null,
    codebase: null,
    workspaces: [],
    primaryWorkspace: null,
    createdAt: new Date("2026-04-24T00:00:00.000Z"),
    updatedAt: new Date("2026-04-24T00:00:00.000Z"),
  })),
  update: vi.fn(),
}));

vi.mock("@/lib/router", () => ({
  Link: ({ children, to, ...props }: { children: unknown; to: string }) => <a href={to} {...props}>{children as never}</a>,
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
  useParams: () => ({ projectId: "project-alpha" }),
  useNavigate: () => navigateMock,
  useLocation: () => ({ pathname: "/projects/project-alpha/factory", search: "", hash: "" }),
}));

vi.mock("../api/projects", () => ({ projectsApi: mockProjectsApi }));
vi.mock("../api/budgets", () => ({ budgetsApi: { overview: vi.fn(async () => ({ policies: [] })), upsertPolicy: vi.fn() } }));
vi.mock("../api/execution-workspaces", () => ({ executionWorkspacesApi: { list: vi.fn(async () => []) } }));
vi.mock("../api/instanceSettings", () => ({ instanceSettingsApi: { getExperimental: vi.fn(async () => ({ enableIsolatedWorkspaces: false })) } }));
vi.mock("../api/issues", () => ({ issuesApi: { list: vi.fn(async () => []), update: vi.fn() } }));
vi.mock("../api/agents", () => ({ agentsApi: { list: vi.fn(async () => []) } }));
vi.mock("../api/heartbeats", () => ({ heartbeatsApi: { liveRunsForCompany: vi.fn(async () => []) } }));
vi.mock("../api/assets", () => ({ assetsApi: { uploadImage: vi.fn(async () => ({ contentPath: "/asset.png" })) } }));

vi.mock("../context/PanelContext", () => ({ usePanel: () => ({ closePanel: closePanelMock }) }));
vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    companies: [{ id: "company-1", name: "Paperclip", issuePrefix: "PC" }],
    selectedCompanyId: "company-1",
    selectedCompany: { id: "company-1", name: "Paperclip", issuePrefix: "PC" },
    setSelectedCompanyId: setSelectedCompanyIdMock,
  }),
}));
vi.mock("../context/ToastContext", () => ({ useToastActions: () => ({ pushToast: pushToastMock }) }));
vi.mock("../context/BreadcrumbContext", () => ({ useBreadcrumbs: () => ({ setBreadcrumbs: setBreadcrumbsMock }) }));

vi.mock("../components/ProjectProperties", () => ({ ProjectProperties: () => <div /> }));
vi.mock("../components/InlineEditor", () => ({ InlineEditor: () => <div /> }));
vi.mock("../components/StatusBadge", () => ({ StatusBadge: () => <div /> }));
vi.mock("../components/BudgetPolicyCard", () => ({ BudgetPolicyCard: () => <div /> }));
vi.mock("../components/IssuesList", () => ({ IssuesList: () => <div /> }));
vi.mock("../components/PageSkeleton", () => ({ PageSkeleton: () => <div>Loading</div> }));
vi.mock("../components/PageTabBar", () => ({
  PageTabBar: ({ items }: { items: Array<{ label: string }> }) => <div>{items.map((item) => item.label).join(", ")}</div>,
}));
vi.mock("../components/ProjectWorkspacesContent", () => ({ ProjectWorkspacesContent: () => <div /> }));
vi.mock("../components/ProjectFactoryContent", () => ({
  ProjectFactoryContent: () => <div data-testid="factory-content-stub">Factory content stub</div>,
}));
vi.mock("../lib/project-workspaces-tab", () => ({ buildProjectWorkspaceSummaries: () => [] }));
vi.mock("@/components/ui/tabs", () => ({ Tabs: ({ children }: { children: unknown }) => <div>{children as never}</div> }));
vi.mock("@/plugins/launchers", () => ({ PluginLauncherOutlet: () => null }));
vi.mock("@/plugins/slots", () => ({
  PluginSlotMount: () => null,
  PluginSlotOutlet: () => null,
  usePluginSlots: () => ({ slots: [], isLoading: false }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe("ProjectDetail", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the Factory tab and shows factory content on the factory route", async () => {
    const root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProjectDetail />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).toContain("Issues, Overview, Factory, Configuration, Budget");
    expect(container.textContent).toContain("Factory content stub");
    expect(mockProjectsApi.get).toHaveBeenCalledWith("project-alpha", "company-1");

    await act(async () => {
      root.unmount();
    });
  });
});
