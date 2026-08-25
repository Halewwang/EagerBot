import {
  IconBuildingBank,
  IconChevronRight,
  IconCode,
  IconDeviceDesktop,
  IconFileText,
  IconKey,
  IconLayoutGrid,
  IconListDetails,
  IconPuzzle,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react";
import {
  createFileRoute,
  Link,
  type LinkOptions,
} from "@tanstack/react-router";
import {
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { StaggerItem } from "@/components/layout/stagger";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authed/admin/")({
  component: RouteComponent,
});

/**
 * Grouped by what the decision is about rather than by how the code is organised.
 *
 * "What Bots can reach" is the group an administrator arrives worrying about, so it goes first.
 * Everything in it either grants a capability or fences one in.
 */
const SECTIONS: {
  title: string;
  description: string;
  items: {
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    linkOptions: LinkOptions;
    title: string;
  }[];
}[] = [
  {
    title: "智能体可访问的内容",
    description: "智能体可以在此应用之外接触的所有内容，以及相关限制。",
    items: [
      {
        title: "凭据",
        description: "此部署持有的密钥和令牌。",
        icon: IconKey,
        linkOptions: { to: "/admin/credentials" },
      },
      {
        title: "边界",
        description: "决定智能体永远不能执行哪些操作的规则。",
        icon: IconShieldCheck,
        linkOptions: { to: "/admin/boundaries" },
      },
      {
        title: "计算机",
        description: "智能体运行工具所使用的机器。",
        icon: IconDeviceDesktop,
        linkOptions: { to: "/admin/computers" },
      },
    ],
  },
  {
    title: "智能体可执行的操作",
    description: "所有智能体可用的能力和界面组件。",
    items: [
      {
        title: "插件",
        description: "此部署可以访问的服务，以及允许访问的智能体。",
        icon: IconPuzzle,
        linkOptions: { to: "/admin/plugins" },
      },
      {
        title: "技能",
        description: "任何人都可以通过斜杠调用的命名指令。",
        icon: IconFileText,
        linkOptions: { to: "/admin/skills" },
      },
      {
        title: "UI 组件",
        description: "智能体可以在对话中绘制的自定义组件。",
        icon: IconLayoutGrid,
        linkOptions: { to: "/admin/components" },
      },
      {
        title: "组件试验场",
        description: "编写组件，并在输入时查看实时渲染结果。",
        icon: IconCode,
        linkOptions: { to: "/admin/playground" },
      },
    ],
  },
  {
    title: "谁可以登录",
    description: "",
    items: [
      {
        title: "用户",
        description:
          "所有登录过的用户、管理此部署的用户，以及访问权限已被移除的用户。",
        icon: IconUsers,
        linkOptions: { to: "/admin/people" },
      },
      {
        title: "身份提供商",
        description:
          "公司的 SAML 或 OpenID Connect 提供商，根据邮箱域名进行路由。",
        icon: IconBuildingBank,
        linkOptions: { to: "/admin/identity-providers" },
      },
    ],
  },
  {
    title: "操作记录",
    description: "",
    items: [
      {
        title: "审计",
        description: "此部署中执行的每项操作，以及执行者。",
        icon: IconListDetails,
        linkOptions: { to: "/admin/audit" },
      },
    ],
  },
];

function RouteComponent() {
  return (
    <PageShell
      description="应用于此部署所有用户的设置。这里的任何更改都会影响每个人和每个智能体，这也是它与个人偏好设置的区别。"
      title="管理"
    >
      {SECTIONS.map((section) => (
        <PageSection
          description={section.description || undefined}
          key={section.title}
          title={section.title}
        >
          <PageRows>
            {section.items.map((item, index) => (
              <StaggerItem index={index} key={item.title}>
                {/*
                 * The whole row is the link, not a chevron somebody has to aim at: every row here
                 * goes exactly one place, so there is nothing else the row could mean.
                 */}
                <Item
                  render={(props) => <Link {...item.linkOptions} {...props} />}
                  size="sm"
                >
                  <ItemMedia>
                    <item.icon className="size-4 text-muted-foreground" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{item.title}</ItemTitle>
                    <ItemDescription>{item.description}</ItemDescription>
                  </ItemContent>
                  <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Item>
                {index !== section.items.length - 1 && <Separator />}
              </StaggerItem>
            ))}
          </PageRows>
        </PageSection>
      ))}
    </PageShell>
  );
}
