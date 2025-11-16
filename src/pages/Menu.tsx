import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Menu as MenuIcon, Lock, ArrowLeft, Copy, Check, ExternalLink, QrCode, Globe, AlertTriangle, Clock, Settings, Palette, Image as ImageIcon, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QRCodeLib from "qrcode";

const Menu = () => {
  const [loading, setLoading] = useState(true);
  const [isNaBrasa, setIsNaBrasa] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [establishment, setEstablishment] = useState<{ id: string; name: string; slug: string; menu_online_enabled?: boolean } | null>(null);
  const [menuUrl, setMenuUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [menuOnlineEnabled, setMenuOnlineEnabled] = useState<boolean>(true);
  const [hasBusinessHours, setHasBusinessHours] = useState<boolean>(false);
  const navigate = useNavigate();
  const sidebarWidth = useSidebarWidth();
  const [isDesktop, setIsDesktop] = useState(false);
  
  // Menu customization state
  const [menuCustomization, setMenuCustomization] = useState({
    primaryColor: "#3b82f6",
    secondaryColor: "#8b5cf6",
    backgroundColor: "#ffffff",
    backgroundColorTransparent: false,
    backgroundImage: "",
    backgroundBlur: 10,
    cardOpacity: 0.95,
    headerStyle: "default" as "default" | "gradient" | "solid",
  });
  const [showCustomization, setShowCustomization] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    const generateQRCode = async () => {
      if (menuUrl) {
        try {
          const dataUrl = await QRCodeLib.toDataURL(menuUrl, {
            width: 256,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          setQrCodeDataUrl(dataUrl);
        } catch (error) {
          console.error("Error generating QR code:", error);
        }
      }
    };
    generateQRCode();
  }, [menuUrl]);

  const checkAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
        return;
      }

      setUserEmail(session.user.email || "");

      // Verifica se é admin do sistema
      const userIsSystemAdmin = session.user.email === 'fellipe_1693@outlook.com';

      // Load user profile e establishment
      const { data: profileData } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", session.user.id)
        .single();

      if (profileData?.establishment_id) {
        const { data: establishmentData } = await supabase
          .from("establishments")
          .select("id, name, slug, menu_online_enabled, timezone, settings")
          .eq("id", profileData.establishment_id)
          .single();

        if (establishmentData) {
          setEstablishment(establishmentData as any);
          // Se o campo não existe (null/undefined), assume true (padrão)
          // Se existe e é false, usa false
          // Se existe e é true, usa true
          const data = establishmentData as any;
          const menuEnabled = data.menu_online_enabled === undefined || 
                              data.menu_online_enabled === null 
                              ? true 
                              : data.menu_online_enabled !== false;
          setMenuOnlineEnabled(menuEnabled);
          
          // Verificar se há horários de funcionamento configurados
          const { data: hoursData } = await (supabase as any)
            .from("establishment_hours")
            .select("id")
            .eq("estab_id", profileData.establishment_id)
            .limit(1);
          
          setHasBusinessHours((hoursData && hoursData.length > 0) || false);
          
          // Generate menu URL
          // Use production domain burgueria.shop when available, otherwise use current origin
          const isProduction = window.location.hostname.includes('burgueria.shop') || 
                               window.location.hostname.includes('vercel.app') ||
                               window.location.hostname.includes('netlify.app');
          const baseUrl = isProduction 
            ? 'https://burgueria.shop' 
            : window.location.origin;
          const estabData = establishmentData as any;
          if (estabData.slug) {
            setMenuUrl(`${baseUrl}/menu-public/${estabData.slug}`);
          }
          
          // Verifica se é Na Brasa (somente se não for admin do sistema)
          if (!userIsSystemAdmin) {
            const establishmentName = estabData.name?.toLowerCase() || '';
            const isNaBrasaUser = establishmentName.includes('na brasa') || 
                                  establishmentName.includes('nabrasa') ||
                                  establishmentName === 'hamburgueria na brasa';
            setIsNaBrasa(isNaBrasaUser);
          } else {
            setIsNaBrasa(false);
          }
          
          // Load menu customization from settings
          if (estabData.settings && estabData.settings.menuCustomization) {
            setMenuCustomization({
              ...menuCustomization,
              ...estabData.settings.menuCustomization,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error checking access:", error);
      toast.error("Erro ao verificar acesso");
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveCustomization = async () => {
    if (!establishment?.id) return;
    
    try {
      // Get current settings
      const { data: currentData } = await supabase
        .from("establishments")
        .select("settings")
        .eq("id", establishment.id)
        .single();
      
      const currentSettings = currentData?.settings || {};
      
      // Update settings with menu customization
      const { error } = await supabase
        .from("establishments")
        .update({
          settings: {
            ...currentSettings,
            menuCustomization,
          },
        })
        .eq("id", establishment.id);
      
      if (error) throw error;
      
      toast.success("Personalização salva com sucesso!");
      setShowCustomization(false);
    } catch (error: any) {
      toast.error(`Erro ao salvar personalização: ${error.message}`);
    }
  };
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !establishment?.id) return;
    
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${establishment.id}/menu-background-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('establishments')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });
      
      if (uploadError) {
        // Se o bucket não existe, tentar criar automaticamente
        if (uploadError.message?.includes('Bucket not found') || 
            uploadError.message?.includes('not found') ||
            uploadError.message?.includes('does not exist')) {
          
          // Tentar criar o bucket automaticamente via Edge Function
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const { data, error: createBucketError } = await supabase.functions.invoke('create-storage-bucket', {
                headers: {
                  Authorization: `Bearer ${session.access_token}`
                }
              });

              if (!createBucketError && data?.success) {
                // Bucket criado, tentar upload novamente
                const { error: retryError } = await supabase.storage
                  .from('establishments')
                  .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false,
                  });

                if (retryError) {
                  // Se ainda falhar, oferecer URL externa
                  toast.error(
                    "Erro ao fazer upload. Use uma URL externa ou verifique as permissões do bucket.",
                    { duration: 7000 }
                  );
                  setShowUrlInput(true);
                  return;
                }

                // Sucesso no retry, continuar com o fluxo normal
                const { data: urlData } = supabase.storage
                  .from('establishments')
                  .getPublicUrl(fileName);
                
                setMenuCustomization({
                  ...menuCustomization,
                  backgroundImage: urlData.publicUrl,
                });
                
                toast.success("Bucket criado e imagem de fundo atualizada!");
                return;
              }
            }
          } catch (createError) {
            console.error('Error creating bucket:', createError);
          }

          // Se não conseguiu criar automaticamente, oferecer URL externa
          toast.error(
            "Bucket 'establishments' não encontrado. Tentando criar automaticamente... Se falhar, use uma URL externa.",
            { duration: 7000 }
          );
          setShowUrlInput(true);
          return;
        }
        throw uploadError;
      }
      
      // Get public URL
      const { data } = supabase.storage
        .from('establishments')
        .getPublicUrl(fileName);
      
      setMenuCustomization({
        ...menuCustomization,
        backgroundImage: data.publicUrl,
      });
      
      toast.success("Imagem de fundo atualizada!");
    } catch (error: any) {
      toast.error(`Erro ao fazer upload: ${error.message}`);
    }
  };
  
  const removeBackgroundImage = () => {
    setMenuCustomization({
      ...menuCustomization,
      backgroundImage: "",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main 
          className="transition-all duration-300 ease-in-out"
          style={{
            marginLeft: isDesktop ? `${sidebarWidth}px` : '0px',
            padding: '1.5rem',
            minHeight: '100vh',
            height: '100vh',
            overflowY: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground">Carregando...</p>
          </div>
        </main>
      </div>
    );
  }

  // Verifica se deve desativar funcionalidade (Na Brasa ou admin do sistema)
  const userIsSystemAdmin = userEmail === 'fellipe_1693@outlook.com';
  const isDisabled = isNaBrasa || userIsSystemAdmin;

  const handleCopyLink = async () => {
    if (!menuUrl) return;
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      toast.success("Link copiado para a área de transferência!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Erro ao copiar link");
    }
  };

  const handleOpenMenu = () => {
    if (menuUrl) {
      window.open(menuUrl, '_blank');
    }
  };

  const handleToggleMenuOnline = async (enabled: boolean) => {
    if (!establishment?.id) {
      toast.error("Erro: Estabelecimento não encontrado");
      return;
    }
    
    try {
      const { data, error } = await (supabase as any)
        .from("establishments")
        .update({ menu_online_enabled: enabled })
        .eq("id", establishment.id)
        .select("menu_online_enabled")
        .single();
      
      if (error) {
        // Verificar se é erro de coluna não existe
        if (error.message?.includes("does not exist") || error.message?.includes("column") || error.code === "42703") {
          toast.error("Campo não encontrado. Execute a migration primeiro!");
        } else {
          throw error;
        }
        return;
      }
      
      // Atualizar estado local com o valor retornado
      if (data) {
        const dataTyped = data as any;
        const newValue = dataTyped.menu_online_enabled !== false;
        setMenuOnlineEnabled(newValue);
        // Atualizar também no objeto establishment
        if (establishment) {
          setEstablishment({
            ...establishment,
            menu_online_enabled: dataTyped.menu_online_enabled
          });
        }
      } else {
        setMenuOnlineEnabled(enabled);
        // Atualizar também no objeto establishment
        if (establishment) {
          setEstablishment({
            ...establishment,
            menu_online_enabled: enabled
          });
        }
      }
      
      toast.success(enabled ? "Cardápio online ativado!" : "Cardápio online desativado!");
    } catch (error: any) {
      const errorMessage = error?.message || "Erro desconhecido";
      toast.error(`Erro ao alterar status: ${errorMessage}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <main 
        className="space-y-6 transition-all duration-300 ease-in-out"
        style={{
          marginLeft: isDesktop ? `${sidebarWidth}px` : '0px',
          padding: '1.5rem',
          minHeight: '100vh',
          height: '100vh',
          overflowY: 'auto'
        }}
      >
        <div className="w-full">
          <h1 className="text-3xl font-bold text-foreground mb-6">Cardápio Online</h1>
          
          <p className="text-muted-foreground mb-6">
            Compartilhe seu cardápio digital com seus clientes e receba pedidos online.
          </p>

          <Card className={isDisabled ? "opacity-60 pointer-events-none" : ""}>
            <CardHeader>
              {isDisabled ? (
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-muted">
                    <Lock className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle>Funcionalidade Desativada</CardTitle>
                    <CardDescription className="mt-1">
                      Esta funcionalidade não está disponível para seu estabelecimento no momento.
                    </CardDescription>
                  </div>
                </div>
              ) : (
                <>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Cardápio Online
                  </CardTitle>
                  <CardDescription>
                    Seu cardápio digital está ativo e pronto para receber pedidos
                  </CardDescription>
                </>
              )}
            </CardHeader>
            <CardContent>
              {isDisabled ? (
                <div className="space-y-6">
                  <div className="p-6 border-2 border-dashed rounded-lg text-center">
                    <MenuIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Esta funcionalidade não está disponível para seu estabelecimento no momento.
                    </p>
                  </div>
                  <div className="flex justify-start">
                    <Button 
                      onClick={() => navigate("/dashboard")} 
                      variant="outline"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Voltar ao Dashboard
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {!establishment?.slug ? (
                    <div className="p-6 border-2 border-dashed rounded-lg text-center">
                      <MenuIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-2">
                        Configurando seu cardápio online...
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Aguarde enquanto configuramos seu link personalizado.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Alerta sobre horário de funcionamento */}
                      {!hasBusinessHours && (
                        <Alert className="mb-6">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="flex items-center justify-between">
                            <div>
                              <p className="font-medium mb-1">Configure os horários de funcionamento</p>
                              <p className="text-sm text-muted-foreground">
                                Adicione os horários de funcionamento do seu estabelecimento para melhor experiência dos clientes.
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate("/settings?tab=hours")}
                              className="ml-4"
                            >
                              <Clock className="h-4 w-4 mr-2" />
                              Adicionar Horários
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Toggle para ativar/desativar cardápio */}
                      <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <Label htmlFor="menuOnlineToggle" className="text-base font-medium">
                              Cardápio Online Ativo
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              {menuOnlineEnabled 
                                ? "Seu cardápio online está ativo e acessível aos clientes"
                                : "Seu cardápio online está desativado e não será acessível aos clientes"}
                            </p>
                          </div>
                          <Switch
                            id="menuOnlineToggle"
                            checked={menuOnlineEnabled}
                            onCheckedChange={handleToggleMenuOnline}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="menuLink" className="mb-2 block">
                            Link do seu cardápio online
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id="menuLink"
                              value={menuUrl}
                              readOnly
                              className="font-mono text-sm"
                            />
                            <Button
                              onClick={handleCopyLink}
                              variant="outline"
                              size="icon"
                              title="Copiar link"
                            >
                              {copied ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              onClick={handleOpenMenu}
                              variant="outline"
                              size="icon"
                              title="Abrir cardápio em nova aba"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Compartilhe este link com seus clientes para que possam fazer pedidos online
                          </p>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          <Button
                            onClick={handleCopyLink}
                            variant="outline"
                            className="flex-1 sm:flex-none"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copiar Link
                          </Button>
                          <Button
                            onClick={handleOpenMenu}
                            variant="default"
                            className="flex-1 sm:flex-none"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Ver Cardápio
                          </Button>
                          <Button
                            onClick={() => setShowQrCode(true)}
                            variant="outline"
                            className="flex-1 sm:flex-none"
                          >
                            <QrCode className="h-4 w-4 mr-2" />
                            QR Code
                          </Button>
                          <Button
                            onClick={() => setShowCustomization(true)}
                            variant="outline"
                            className="flex-1 sm:flex-none"
                          >
                            <Palette className="h-4 w-4 mr-2" />
                            Personalizar
                          </Button>
                        </div>
                      </div>

                      <div className="border-t pt-6 space-y-4">
                        <h3 className="font-semibold text-lg">Como funciona</h3>
                        <div className="space-y-3">
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-bold text-primary">1</span>
                            </div>
                            <div>
                              <p className="font-medium">Compartilhe o link</p>
                              <p className="text-sm text-muted-foreground">
                                Envie o link do cardápio para seus clientes via WhatsApp, redes sociais ou exiba o QR Code no seu estabelecimento
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-bold text-primary">2</span>
                            </div>
                            <div>
                              <p className="font-medium">Clientes fazem pedidos</p>
                              <p className="text-sm text-muted-foreground">
                                Seus clientes visualizam os produtos, adicionam ao carrinho e finalizam o pedido informando seus dados
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-bold text-primary">3</span>
                            </div>
                            <div>
                              <p className="font-medium">Você recebe e processa</p>
                              <p className="text-sm text-muted-foreground">
                                Os pedidos aparecerão na aba "Pendentes (Cardápio Online)" onde você pode aceitar, imprimir e gerenciar
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-start gap-2">
                        <Button 
                          onClick={() => navigate("/dashboard")} 
                          variant="outline"
                        >
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Voltar ao Dashboard
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* QR Code Dialog */}
      <Dialog open={showQrCode} onOpenChange={setShowQrCode}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code do Cardápio</DialogTitle>
            <DialogDescription>
              Escaneie este código para acessar o cardápio online
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4">
            {menuUrl ? (
              <div className="p-6 bg-white rounded-lg border-2 border-border">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-2 bg-white rounded flex items-center justify-center">
                    {qrCodeDataUrl ? (
                      <img 
                        src={qrCodeDataUrl} 
                        alt="QR Code do Cardápio" 
                        className="w-64 h-64"
                      />
                    ) : (
                      <div className="w-64 h-64 bg-muted rounded flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">Gerando QR Code...</p>
                      </div>
                    )}
                  </div>
                  <div className="text-center max-w-sm">
                    <p className="text-sm font-medium mb-1">Escaneie com seu celular</p>
                    <p className="text-xs text-muted-foreground break-all">
                      {menuUrl}
                    </p>
                  </div>
                  <Button
                    onClick={handleCopyLink}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Link
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Gerando QR Code...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Customization Dialog */}
      <Dialog open={showCustomization} onOpenChange={setShowCustomization}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Personalizar Cardápio Online
            </DialogTitle>
            <DialogDescription>
              Personalize as cores, imagens e estilo do seu cardápio online
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="colors" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="colors">Cores</TabsTrigger>
              <TabsTrigger value="background">Fundo</TabsTrigger>
              <TabsTrigger value="style">Estilo</TabsTrigger>
            </TabsList>
            
            <TabsContent value="colors" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Cor Primária</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={menuCustomization.primaryColor}
                    onChange={(e) => setMenuCustomization({ ...menuCustomization, primaryColor: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={menuCustomization.primaryColor}
                    onChange={(e) => setMenuCustomization({ ...menuCustomization, primaryColor: e.target.value })}
                    className="flex-1"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Cor Secundária</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={menuCustomization.secondaryColor}
                    onChange={(e) => setMenuCustomization({ ...menuCustomization, secondaryColor: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={menuCustomization.secondaryColor}
                    onChange={(e) => setMenuCustomization({ ...menuCustomization, secondaryColor: e.target.value })}
                    className="flex-1"
                    placeholder="#8b5cf6"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="backgroundColor">Cor de Fundo</Label>
                {menuCustomization.backgroundImage && (
                  <p className="text-xs text-muted-foreground mb-2">
                    💡 Com imagem de fundo, você pode tornar a cor transparente na aba "Fundo"
                  </p>
                )}
                <div className="flex gap-2 items-center">
                  <Input
                    id="backgroundColor"
                    type="color"
                    value={menuCustomization.backgroundColor}
                    onChange={(e) => setMenuCustomization({ ...menuCustomization, backgroundColor: e.target.value })}
                    className="w-20 h-10"
                    disabled={menuCustomization.backgroundImage && menuCustomization.backgroundColorTransparent}
                  />
                  <Input
                    type="text"
                    value={menuCustomization.backgroundColor}
                    onChange={(e) => setMenuCustomization({ ...menuCustomization, backgroundColor: e.target.value })}
                    className="flex-1"
                    placeholder="#ffffff"
                    disabled={menuCustomization.backgroundImage && menuCustomization.backgroundColorTransparent}
                  />
                </div>
                {menuCustomization.backgroundImage && menuCustomization.backgroundColorTransparent && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ A cor de fundo está transparente. Desative a transparência na aba "Fundo" para editar a cor.
                  </p>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="background" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Imagem de Fundo</Label>
                {menuCustomization.backgroundImage ? (
                  <div className="relative">
                    <img
                      src={menuCustomization.backgroundImage}
                      alt="Background preview"
                      className="w-full h-48 object-cover rounded-lg border"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={removeBackgroundImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">Nenhuma imagem de fundo</p>
                      <div className="flex gap-2 justify-center">
                        <Label htmlFor="backgroundUpload" className="cursor-pointer">
                          <Button variant="outline" asChild>
                            <span>Fazer Upload</span>
                          </Button>
                        </Label>
                        <Button
                          variant="outline"
                          onClick={() => setShowUrlInput(!showUrlInput)}
                        >
                          Usar URL Externa
                        </Button>
                      </div>
                      <Input
                        id="backgroundUpload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <p className="text-xs text-muted-foreground mt-3">
                        💡 Dica: Se o upload falhar, use uma URL externa ou crie o bucket 'establishments' no Supabase Storage
                      </p>
                    </div>
                    {showUrlInput && (
                      <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
                        <Label htmlFor="imageUrl">URL da Imagem</Label>
                        <Input
                          id="imageUrl"
                          type="url"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="https://exemplo.com/imagem.jpg"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              if (imageUrl) {
                                setMenuCustomization({
                                  ...menuCustomization,
                                  backgroundImage: imageUrl,
                                });
                                setImageUrl("");
                                setShowUrlInput(false);
                                toast.success("URL da imagem definida!");
                              } else {
                                toast.error("Por favor, insira uma URL válida");
                              }
                            }}
                          >
                            Usar esta URL
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowUrlInput(false);
                              setImageUrl("");
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="backgroundBlur">
                  Desfoque da Imagem: {menuCustomization.backgroundBlur}px
                </Label>
                <Input
                  id="backgroundBlur"
                  type="range"
                  min="0"
                  max="20"
                  value={menuCustomization.backgroundBlur}
                  onChange={(e) => setMenuCustomization({ ...menuCustomization, backgroundBlur: parseInt(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  Ajuste o nível de desfoque da imagem de fundo
                </p>
              </div>

              {menuCustomization.backgroundImage && (
                <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="backgroundColorTransparent" className="text-sm font-medium">
                        Cor de Fundo Transparente
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Quando ativado, remove a cor de fundo para que a imagem apareça sem sobreposição
                      </p>
                    </div>
                    <Switch
                      id="backgroundColorTransparent"
                      checked={menuCustomization.backgroundColorTransparent}
                      onCheckedChange={(checked) => 
                        setMenuCustomization({ ...menuCustomization, backgroundColorTransparent: checked })
                      }
                    />
                  </div>
                  {!menuCustomization.backgroundColorTransparent && (
                    <div className="mt-3 space-y-2">
                      <Label htmlFor="backgroundColorWithImage" className="text-sm">
                        Cor de Fundo (quando não transparente)
                      </Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          id="backgroundColorWithImage"
                          type="color"
                          value={menuCustomization.backgroundColor}
                          onChange={(e) => setMenuCustomization({ ...menuCustomization, backgroundColor: e.target.value })}
                          className="w-20 h-10"
                        />
                        <Input
                          type="text"
                          value={menuCustomization.backgroundColor}
                          onChange={(e) => setMenuCustomization({ ...menuCustomization, backgroundColor: e.target.value })}
                          className="flex-1"
                          placeholder="#ffffff"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="style" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="cardOpacity">
                  Opacidade dos Cards: {Math.round(menuCustomization.cardOpacity * 100)}%
                </Label>
                <Input
                  id="cardOpacity"
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.05"
                  value={menuCustomization.cardOpacity}
                  onChange={(e) => setMenuCustomization({ ...menuCustomization, cardOpacity: parseFloat(e.target.value) })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="headerStyle">Estilo do Cabeçalho</Label>
                <select
                  id="headerStyle"
                  value={menuCustomization.headerStyle}
                  onChange={(e) => setMenuCustomization({ ...menuCustomization, headerStyle: e.target.value as any })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="default">Padrão</option>
                  <option value="gradient">Gradiente</option>
                  <option value="solid">Sólido</option>
                </select>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowCustomization(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCustomization}
            >
              Salvar Personalização
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Menu;

