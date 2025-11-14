// ============================================
// EDGE FUNCTION: EXPORTAR DADOS PARA R2/BLOB
// Esta função é chamada pelos jobs de cron para exportar dados
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ArchiveJob {
  id: string;
  job_type: string;
  establishment_id: string;
  target_date: string;
  status: string;
  file_format: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verifica jobs pendentes
    const { data: pendingJobs, error: jobsError } = await supabaseClient
      .from("archive_jobs")
      .select("*")
      .eq("status", "pending")
      .order("target_date", { ascending: true })
      .limit(10);

    if (jobsError) throw jobsError;

    if (!pendingJobs || pendingJobs.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum job pendente" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const results = [];

    for (const job of pendingJobs) {
      try {
        // Atualiza status para processando
        await supabaseClient.rpc("update_export_job", {
          p_job_id: job.id,
          p_status: "processing",
        });

        let jsonData: any = null;
        let recordsCount = 0;

        // Exporta dados baseado no tipo de job
        if (job.job_type === "export_orders") {
          const { data, error } = await supabaseClient.rpc(
            "export_orders_to_json",
            {
              p_establishment_id: job.establishment_id,
              p_date: job.target_date,
            }
          );
          if (error) throw error;
          jsonData = data;
          recordsCount = Array.isArray(data) ? data.length : 0;
        } else if (job.job_type === "export_cash") {
          const { data, error } = await supabaseClient.rpc(
            "export_cash_sessions_to_json",
            {
              p_establishment_id: job.establishment_id,
              p_date: job.target_date,
            }
          );
          if (error) throw error;
          jsonData = data;
          recordsCount = Array.isArray(data) ? data.length : 0;
        }

        if (!jsonData) {
          throw new Error("Nenhum dado exportado");
        }

        // Converte para JSON string
        const jsonString = JSON.stringify(jsonData, null, 2);
        const fileSize = new Blob([jsonString]).size;

        // Gera nome do arquivo
        const fileName = `${job.job_type}_${job.establishment_id}_${job.target_date}.json`;
        const filePath = `archives/${job.establishment_id}/${job.target_date}/${fileName}`;

        // Aqui você faria o upload para R2/Blob
        // Por enquanto, vamos apenas simular
        // TODO: Implementar upload real para R2 usando Cloudflare Workers API ou S3-compatible API

        const fileUrl = `https://your-r2-bucket.com/${filePath}`;

        // Atualiza job como completo
        await supabaseClient.rpc("update_export_job", {
          p_job_id: job.id,
          p_status: "completed",
          p_file_path: filePath,
          p_file_url: fileUrl,
          p_file_size_bytes: fileSize,
          p_records_count: recordsCount,
        });

        results.push({
          job_id: job.id,
          status: "completed",
          file_path: filePath,
          records_count: recordsCount,
        });
      } catch (error: any) {
        // Marca job como falho
        await supabaseClient.rpc("update_export_job", {
          p_job_id: job.id,
          p_status: "failed",
          p_error_message: error.message,
        });

        results.push({
          job_id: job.id,
          status: "failed",
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Jobs processados",
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

