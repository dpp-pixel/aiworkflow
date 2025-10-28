package servlet;

import java.io.*;
import javax.servlet.*;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.*;
import dao.MovieDAO;
import model.Member;

@WebServlet("/DeleteMemberServlet.do")
public class DeleteMemberServlet extends HttpServlet {
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // 세션 가져오기
        HttpSession session = request.getSession(false);
        if(session == null || session.getAttribute("member") == null) {
            response.sendRedirect("login.jsp");
            return;
        }

        // 현재 로그인된 회원 정보 가져오기
        Member member = (Member) session.getAttribute("member");
        String id = member.getId();

        // DAO로 회원 삭제
        MovieDAO dao = new MovieDAO();
        int result = dao.deleteMember(id);

        response.setContentType("text/html; charset=UTF-8");
        PrintWriter out = response.getWriter();

        if(result > 0) {
            // 세션 종료
            session.invalidate();

            out.println("<script>");
            out.println("alert('회원탈퇴 되었습니다.');");
            out.println("location.href='index.jsp';");
            out.println("</script>");
        } else {
            out.println("<script>");
            out.println("alert('회원탈퇴 중 오류가 발생했습니다.');");
            out.println("history.back();");
            out.println("</script>");
        }
    }
}
